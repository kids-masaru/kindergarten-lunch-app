from PIL import Image
import os

def process_icon(input_path, output_path, zoom_factor=1.5):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    # Identify the bounding box of the colored part
    # We look for pixels that are NOT white (assuming white is background)
    # Background might be transparent or white.
    # In the screenshot it looks white.
    
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    diff = Image.new("RGBA", img.size, (0, 0, 0, 0))
    
    # Get bbox of all pixels that are NOT purely white
    # (since the background is white #FFFFFF)
    def is_not_white(rgba):
        return rgba[0] < 250 or rgba[1] < 250 or rgba[2] < 250

    # More robust: find pixels with saturation/color
    bbox = img.getbbox() # This works if background is transparent
    
    # If background is white, we need to find the bbox manually or use ImageChops
    from PIL import ImageChops
    invert_img = ImageChops.invert(img.convert("RGB"))
    bbox = invert_img.getbbox()
    
    if not bbox:
        print("No content found")
        return

    # Original content width/height
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    
    # The user wants "1.5x zoom" or "large like it fills the frame".
    # Zooming in by 1.5x means we take a smaller area and scale it up.
    # Or simply crop more tightly.
    
    # If we crop tightly to the orange square, it will already look larger in the same size container.
    # Let's crop to the bbox and save.
    
    # Scale calculation: 
    # If the user says 1.5x larger, we should crop into the orange square slightly?
    # "トリミング的な感じして周りの余分なの消して1.5倍くらいに大きくZoomで"
    # This implies cropping tightly to the orange area is the priority.
    
    padding = 20 # small margin
    crop_bbox = (
        max(0, bbox[0] - padding),
        max(0, bbox[1] - padding),
        min(img.width, bbox[2] + padding),
        min(img.height, bbox[3] + padding)
    )
    
    cropped = img.crop(crop_bbox)
    
    # The user specifically said "1.5x zoom". 
    # Let's zoom into the central character if it's already tight?
    # Actually, tighter crop IS zooming for icons.
    
    cropped.save(output_path)
    print(f"Processed icon saved to {output_path}")

if __name__ == "__main__":
    base = r"c:\Users\HP\OneDrive\ドキュメント\mamameal\kindergarten-lunch-app\frontend\public"
    inp = os.path.join(base, "icon-mamamire.png")
    out = os.path.join(base, "icon-mamamire-v2.png")
    process_icon(inp, out)
