from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import os
import json
import time
from datetime import datetime

app = Flask(__name__)

CACHE_FILE = 'cache.json'
CACHE_EXPIRY = 600  # 10 minutes in seconds
FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

def parse_feed_content():
    """Fetches and parses the BigQuery release notes XML feed."""
    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()
    xml_content = response.content
    
    root = ET.fromstring(xml_content)
    ns = {'ns': 'http://www.w3.org/2005/Atom'}
    
    updates = []
    for entry_node in root.findall('ns:entry', ns):
        title_node = entry_node.find('ns:title', ns)
        updated_node = entry_node.find('ns:updated', ns)
        link_node = entry_node.find('ns:link[@rel="alternate"]', ns)
        if link_node is None:
            link_node = entry_node.find('ns:link', ns)
        content_node = entry_node.find('ns:content', ns)
        
        date_str = title_node.text if title_node is not None else ""
        updated_str = updated_node.text if updated_node is not None else ""
        link_url = link_node.attrib.get('href', '') if link_node is not None else ""
        content_html = content_node.text if content_node is not None else ""
        
        soup = BeautifulSoup(content_html, 'html.parser')
        
        current_type = None
        current_elements = []
        
        for child in soup.contents:
            if hasattr(child, 'name') and child.name == 'h3':
                if current_type is not None:
                    html_str = "".join(str(el) for el in current_elements).strip()
                    text_str = BeautifulSoup(html_str, 'html.parser').get_text().strip()
                    updates.append({
                        'date': date_str,
                        'updated_date': updated_str,
                        'type': current_type,
                        'content': html_str,
                        'plain_text': text_str,
                        'link': link_url
                    })
                    current_elements = []
                current_type = child.get_text().strip()
            else:
                if current_type is not None:
                    current_elements.append(child)
                else:
                    if child.name or (isinstance(child, str) and child.strip()):
                        current_type = "Update"
                        current_elements.append(child)
                        
        if current_type is not None:
            html_str = "".join(str(el) for el in current_elements).strip()
            text_str = BeautifulSoup(html_str, 'html.parser').get_text().strip()
            updates.append({
                'date': date_str,
                'updated_date': updated_str,
                'type': current_type,
                'content': html_str,
                'plain_text': text_str,
                'link': link_url
            })
            
    return updates

def load_cached_data():
    """Loads cached release notes from the local JSON file if it exists."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                data = json.load(f)
                # Ensure it has all the expected fields
                if 'updates' in data and 'last_updated' in data:
                    return data
        except Exception:
            pass
    return None

def save_cache_data(updates):
    """Saves parsed updates to the local JSON file with a timestamp."""
    data = {
        'last_updated': time.time(),
        'last_updated_formatted': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'updates': updates
    }
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass
    return data

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cached = load_cached_data()
    
    # Check if cache is fresh
    if not force_refresh and cached:
        age = time.time() - cached['last_updated']
        if age < CACHE_EXPIRY:
            return jsonify({
                'source': 'cache',
                'last_updated': cached['last_updated_formatted'],
                'updates': cached['updates']
            })
            
    # Fetch and parse
    try:
        updates = parse_feed_content()
        cached_data = save_cache_data(updates)
        return jsonify({
            'source': 'network',
            'last_updated': cached_data['last_updated_formatted'],
            'updates': updates
        })
    except Exception as e:
        # Fallback to cache if request fails
        if cached:
            return jsonify({
                'source': 'fallback-cache',
                'error': str(e),
                'last_updated': cached['last_updated_formatted'],
                'updates': cached['updates']
            })
        return jsonify({
            'error': f'Failed to fetch feed and no cached data available. Details: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
