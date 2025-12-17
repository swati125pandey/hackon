#!/usr/bin/env python3
import struct
import zlib
import os

def create_png(width, height, filename):
    """Create a simple solid colored PNG icon."""
    
    def output32(val):
        return struct.pack('>I', val)
    
    # Build raw image data (RGBA)
    raw_data = b''
    for y in range(height):
        raw_data += bytes([0])  # filter type none
        for x in range(width):
            # Cyan color: RGB(34, 211, 238) with full alpha
            raw_data += bytes([34, 211, 238, 255])
    
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xffffffff
        return output32(len(data)) + chunk + output32(crc)
    
    # PNG signature
    signature = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    
    # IHDR chunk: width, height, bit depth (8), color type (6=RGBA), compression, filter, interlace
    ihdr = output32(width) + output32(height) + bytes([8, 6, 0, 0, 0])
    
    # Compress image data
    compressed = zlib.compress(raw_data, 9)
    
    # Build complete PNG
    png_data = (
        signature +
        png_chunk(b'IHDR', ihdr) +
        png_chunk(b'IDAT', compressed) +
        png_chunk(b'IEND', b'')
    )
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'wb') as f:
        f.write(png_data)
    print(f'Created {filename}')

if __name__ == '__main__':
    create_png(16, 16, 'icons/icon16.png')
    create_png(48, 48, 'icons/icon48.png')
    create_png(128, 128, 'icons/icon128.png')
    print('All icons created successfully!')

