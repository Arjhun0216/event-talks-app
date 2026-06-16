import os
import time
import json
import hashlib
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "release_notes_cache.json"
CACHE_EXPIRY_SECONDS = 3600  # 1 hour

def parse_release_notes(feed_xml):
    """
    Parses the Atom XML feed for BigQuery release notes.
    Groups updates by date, but splits individual entries into sub-updates
    based on the <h3> tags (e.g., Feature, Issue, Deprecation) for granular access.
    """
    try:
        # Avoid entity unresolved errors by parsing carefully
        root = ET.fromstring(feed_xml)
    except Exception as e:
        print(f"XML Parsing Error: {e}")
        # Try parsing with BeautifulSoup in xml mode if ET fails
        try:
            soup = BeautifulSoup(feed_xml, 'xml')
            entries = []
            for entry in soup.find_all('entry'):
                title = entry.find('title')
                date_str = title.get_text() if title else "Unknown Date"
                
                updated = entry.find('updated')
                updated_val = updated.get_text() if updated else ""
                
                link = entry.find('link', rel='alternate') or entry.find('link')
                link_url = link.get('href') if link else ""
                
                content = entry.find('content')
                if not content or not content.get_text():
                    continue
                
                content_html = content.get_text()
                entries.extend(split_html_content(content_html, date_str, updated_val, link_url))
            return entries
        except Exception as e2:
            print(f"Fallback XML Parsing Error: {e2}")
            return []

    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', ns)
        updated_val = updated_elem.text if updated_elem is not None else ""
        
        # Look for alternate link
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        link_url = link_elem.attrib.get('href', '') if link_elem is not None else ''
        
        content_elem = entry.find('atom:content', ns)
        if content_elem is None or content_elem.text is None:
            continue
            
        content_html = content_elem.text
        entries.extend(split_html_content(content_html, date_str, updated_val, link_url))
        
    return entries

def split_html_content(content_html, date_str, updated_val, link_url):
    """
    Helper to split entry content HTML by h3 headers (e.g. Feature, Issue, etc.).
    """
    soup = BeautifulSoup(content_html, 'html.parser')
    h3_tags = soup.find_all('h3')
    
    sub_updates = []
    
    if not h3_tags:
        # No h3 tags, treat the whole content as one update
        text_content = soup.get_text().strip()
        item = {
            'date': date_str,
            'updated': updated_val,
            'link': link_url,
            'type': 'Update',
            'content': str(soup).strip(),
            'text_content': text_content
        }
        item['id'] = generate_id(item)
        sub_updates.append(item)
        return sub_updates

    # We iterate and accumulate contents for each h3
    current_type = None
    current_elements = []
    
    # We can inspect top-level siblings in BS4
    for child in soup.contents:
        # skip empty strings or text wrappers at top level unless we have a current type
        if child.name == 'h3':
            # Save the previous block before starting the new one
            if current_type and current_elements:
                block_html = "".join(str(el) for el in current_elements)
                text_content = BeautifulSoup(block_html, 'html.parser').get_text().strip()
                item = {
                    'date': date_str,
                    'updated': updated_val,
                    'link': link_url,
                    'type': current_type,
                    'content': block_html.strip(),
                    'text_content': text_content
                }
                item['id'] = generate_id(item)
                sub_updates.append(item)
                
            current_type = child.get_text().strip()
            current_elements = []
        elif current_type:
            current_elements.append(child)
            
    # Save the last block
    if current_type and current_elements:
        block_html = "".join(str(el) for el in current_elements)
        text_content = BeautifulSoup(block_html, 'html.parser').get_text().strip()
        item = {
            'date': date_str,
            'updated': updated_val,
            'link': link_url,
            'type': current_type,
            'content': block_html.strip(),
            'text_content': text_content
        }
        item['id'] = generate_id(item)
        sub_updates.append(item)
        
    return sub_updates

def generate_id(item):
    """
    Generates a deterministic unique ID based on the content fields.
    """
    val = f"{item['date']}_{item['type']}_{item['content']}"
    return hashlib.md5(val.encode('utf-8')).hexdigest()

def fetch_feed_data():
    """
    Fetches XML from Google Cloud BigQuery feed and parses it.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    # Decode utf-8 content
    return parse_release_notes(response.text)

def get_release_notes(force_refresh=False):
    """
    Gets release notes, utilizing a local file cache.
    """
    now = time.time()
    
    # Check if cache exists and is fresh
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            cache_time = os.path.getmtime(CACHE_FILE)
            if now - cache_time < CACHE_EXPIRY_SECONDS:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data:
                        return data, "cached"
        except Exception as e:
            print(f"Error reading cache: {e}")
            
    # Fetch fresh data
    try:
        data = fetch_feed_data()
        if data:
            # Write to cache
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return data, "fresh"
    except Exception as e:
        print(f"Error fetching fresh data: {e}")
        # Try returning expired cache as fallback
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data, "stale_fallback"
            except Exception:
                pass
        raise e
        
    return [], "empty"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes', methods=['GET'])
def api_release_notes():
    try:
        data, status = get_release_notes(force_refresh=False)
        return jsonify({
            'success': True,
            'status': status,
            'count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/release-notes/refresh', methods=['POST'])
def api_refresh_release_notes():
    try:
        data, status = get_release_notes(force_refresh=True)
        return jsonify({
            'success': True,
            'status': status,
            'count': len(data),
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
