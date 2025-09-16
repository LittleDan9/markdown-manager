#!/usr/bin/env python3
"""
Test script for the new RESTful Icon API

This script demonstrates the new API structure and validates that it works correctly.
Run this after deploying the new endpoints to verify functionality.
"""

import asyncio
import httpx

BASE_URL = "http://localhost:8000"


async def test_restful_api():
    """Test the new RESTful icon API endpoints."""

    async with httpx.AsyncClient() as client:
        print("Testing New RESTful Icon API")
        print("=" * 50)

        # Test 1: Get overview
        print("\n1. Testing /icons/overview")
        try:
            response = await client.get(f"{BASE_URL}/icons/overview")
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Overview: {data.get('total_packs', 0)} packs, {data.get('total_icons', 0)} icons")
                print(f"  Categories: {', '.join(data.get('categories', []))}")
            else:
                print(f"✗ Failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Error: {e}")

        # Test 2: List packs
        print("\n2. Testing /icons/packs")
        try:
            response = await client.get(f"{BASE_URL}/icons/packs")
            if response.status_code == 200:
                packs = response.json()
                print(f"✓ Found {len(packs)} packs")
                if packs:
                    first_pack = packs[0]
                    print(f"  First pack: {first_pack.get('name')} ({first_pack.get('icon_count', 0)} icons)")

                    # Test 3: Get specific pack
                    pack_name = first_pack.get('name')
                    if pack_name:
                        print(f"\n3. Testing /icons/packs/{pack_name}")
                        pack_response = await client.get(f"{BASE_URL}/icons/packs/{pack_name}")
                        if pack_response.status_code == 200:
                            pack_data = pack_response.json()
                            print(f"✓ Pack details: {pack_data.get('display_name')}")
                            if 'urls' in pack_data:
                                print(f"  Reference URLs: {list(pack_data['urls'].keys())}")
                        else:
                            print(f"✗ Pack fetch failed: {pack_response.status_code}")

                        # Test 4: List icons in pack
                        print(f"\n4. Testing /icons/packs/{pack_name}")
                        icons_response = await client.get(f"{BASE_URL}/icons/packs/{pack_name}?size=5")
                        if icons_response.status_code == 200:
                            icons_data = icons_response.json()
                            print(f"✓ Found {icons_data.get('total', 0)} icons (showing {len(icons_data.get('icons', []))})")

                            if icons_data.get('icons'):
                                first_icon = icons_data['icons'][0]
                                icon_key = first_icon.get('key')

                                if icon_key:
                                    # Test 5: Get icon metadata
                                    print(f"\n5. Testing /icons/packs/{pack_name}/{icon_key}")
                                    icon_response = await client.get(f"{BASE_URL}/icons/packs/{pack_name}/{icon_key}")
                                    if icon_response.status_code == 200:
                                        icon_data = icon_response.json()
                                        print(f"✓ Icon metadata: {icon_data.get('key')}")
                                        if 'urls' in icon_data:
                                            print(f"  Reference URLs: {list(icon_data['urls'].keys())}")
                                    else:
                                        print(f"✗ Icon metadata failed: {icon_response.status_code}")

                                    # Test 6: Get raw SVG
                                    print(f"\n6. Testing /icons/packs/{pack_name}/{icon_key}/raw")
                                    raw_url = f"{BASE_URL}/icons/packs/{pack_name}/{icon_key}/raw"
                                    raw_response = await client.get(raw_url)
                                    if raw_response.status_code == 200:
                                        content_type = raw_response.headers.get('content-type', '')
                                        svg_size = len(raw_response.content)
                                        print(f"✓ Raw SVG: {content_type}, {svg_size} bytes")
                                        if content_type == 'image/svg+xml':
                                            print("  ✓ Correct MIME type for browser rendering")
                                        else:
                                            print(f"  ✗ Wrong MIME type: {content_type}")
                                    else:
                                        print(f"✗ Raw SVG failed: {raw_response.status_code}")

                                    # Test 7: Get SVG as JSON
                                    print(f"\n7. Testing /icons/packs/{pack_name}/{icon_key}/svg")
                                    svg_url = f"{BASE_URL}/icons/packs/{pack_name}/{icon_key}/svg"
                                    svg_response = await client.get(svg_url)
                                    if svg_response.status_code == 200:
                                        svg_data = svg_response.json()
                                        print(f"✓ SVG JSON: {svg_data.get('content_type')}")
                                        if 'urls' in svg_data:
                                            print(f"  Reference URLs: {list(svg_data['urls'].keys())}")
                                    else:
                                        print(f"✗ SVG JSON failed: {svg_response.status_code}")
                        else:
                            print(f"✗ Icons list failed: {icons_response.status_code}")
            else:
                print(f"✗ Failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Error: {e}")

        # Test 8: Search functionality
        print("\n8. Testing /icons/search")
        try:
            search_response = await client.get(f"{BASE_URL}/icons/search?q=cloud&size=3")
            if search_response.status_code == 200:
                search_data = search_response.json()
                print(f"✓ Search results: {search_data.get('total', 0)} found (showing {len(search_data.get('icons', []))})")

                # Check if results have reference URLs
                if search_data.get('icons'):
                    first_result = search_data['icons'][0]
                    if 'urls' in first_result:
                        print(f"  ✓ Search results include reference URLs: {list(first_result['urls'].keys())}")
                    else:
                        print("  ✗ Search results missing reference URLs")
            else:
                print(f"✗ Search failed: {search_response.status_code}")
        except Exception as e:
            print(f"✗ Search error: {e}")

        print("\n" + "=" * 50)
        print("RESTful API Test Complete")


if __name__ == "__main__":
    asyncio.run(test_restful_api())
