
let usedImages = new Set();
let imageList = [];

const MAX_IMAGES = 100; // Easily change this number
const imageFolder = 'images/';
const maxRetries = 50;

function preloadImages() {
  for (let i = 1; i <= MAX_IMAGES; i++) {
    const filename = `image_${i}.jpg`;
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

  let retries = 0;
  let selected = null;

  while (retries < maxRetries) {
    const randomIndex = Math.floor(Math.random() * available.length);
    const candidate = available[randomIndex];

    const img = new Image();
    img.src = candidate;

    img.onload = () => {
      usedImages.add(candidate);
      document.getElementById('randomImage').src = candidate;
    };

    img.onerror = () => {
      retries++;
      showRandomImage(); // Try another
    };

    return; // Exit after attempting to load one
  }

  alert("Couldn't find a valid image after several tries.");
}

function resetImages() {
  usedImages.clear();
  document.getElementById('randomImage').src = "";
}

window.onload = preloadImages;
