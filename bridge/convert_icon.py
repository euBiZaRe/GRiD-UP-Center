from PIL import Image
import os

def convert_to_ico():
    input_path = r"F:\Grid Up\Team App\assets\images\Grid Up Sim Endurance.png"
    output_path = r"F:\Grid Up\Team App\assets\icons\app.ico"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if os.path.exists(input_path):
        img = Image.open(input_path)
        # Resize to standard icon sizes
        img.save(output_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        print(f"Icon converted: {output_path}")
    else:
        print(f"Error: {input_path} not found")

if __name__ == "__main__":
    convert_to_ico()
