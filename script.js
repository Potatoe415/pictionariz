
let usedImages = new Set();
let imageList = [];

const MAX_IMAGES = 100;
const imageFolder = 'images/';
const maxRetries = 50;

function updateCounter() {
  document.getElementById('imageCount').innerText = imageList.length;
}

function preloadImages() {
  let loaded = 0;
  for (let i = 1; i <= MAX_IMAGES; i++) {
    const filename = `image_${i}.jpg`;
    const img = new Image();
    img.onload = () => {
      imageList.push(imageFolder + filename);
      loaded++;
      if (loaded === MAX_IMAGES) updateCounter();
      else updateCounter();
    };
    img.onerror = () => {
      loaded++;
      if (loaded === MAX_IMAGES) updateCounter();
    };
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

  function tryNext() {
    if (retries >= maxRetries) {
      alert("Couldn't find a valid image after several tries.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const candidate = available[randomIndex];

    const img = new Image();
    img.onload = () => {
      usedImages.add(candidate);
      document.getElementById('randomImage').src = candidate;
    };
    img.onerror = () => {
      retries++;
      tryNext();
    };
    img.src = candidate;
  }

  tryNext();
}

function resetImages() {
  usedImages.clear();
  document.getElementById('randomImage').src = "";
  showRandomImage();
}


window.onload = () => {
  preloadImages();
  setTimeout(() => {
    showRandomImage();
  }, 500);
};


// Swipe gesture support
let touchStartX = null;

document.addEventListener("touchstart", function (e) {
  touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener("touchend", function (e) {
  if (touchStartX === null) return;
  let touchEndX = e.changedTouches[0].screenX;
  let diffX = touchStartX - touchEndX;

  if (Math.abs(diffX) > 30) { // Only count swipe if distance is significant
    if (diffX > 0) {
      // Swipe Left: Show next image
      showRandomImage();
    } else {
      // Swipe Right: Reset
      resetImages();
    }
  }

  touchStartX = null;
}, false);
