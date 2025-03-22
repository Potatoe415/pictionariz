
let usedImages = new Set();
let imageList = [];

const MAX_IMAGES = 100; // Change this number to increase the range
const imageFolder = 'images/';

function preloadImages() {
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  for (let i = 1; i <= MAX_IMAGES; i++) {
    const filename = `image_${i}.jpg`; // default to .jpg, can extend later
    const img = new Image();
    img.onload = () => {
      imageList.push(imageFolder + filename);
    };
    img.onerror = () => {};
    img.src = imageFolder + filename;
  }
}

function showRandomImage() {
  const available = imageList.filter(img => !usedImages.has(img));
  if (available.length === 0) {
    alert("No more new images. Click Reset or refresh the page.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  const selected = available[randomIndex];
  usedImages.add(selected);

  document.getElementById('randomImage').src = selected;
}

function resetImages() {
  usedImages.clear();
  document.getElementById('randomImage').src = "";
}

window.onload = preloadImages;
