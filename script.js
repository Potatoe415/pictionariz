
let usedImages = new Set();
let imageList = [];
let currentFolder = 'img_pictionariz';
let imageHistory = [];
let currentIndex = -1;

const MAX_IMAGES = 100;
const maxRetries = 50;

function updateCounter() {
  document.getElementById('imageCount').innerText = imageList.length;
}

function loadImagesFromFolder(folder) {
  imageList = [];
  usedImages.clear();
  imageHistory = [];
  currentIndex = -1;
  let loaded = 0;
  for (let i = 1; i <= MAX_IMAGES; i++) {
    const filename = `image_${i}.jpg`;
    const img = new Image();
    img.onload = () => {
      imageList.push(`${folder}/${filename}`);
      loaded++;
      updateCounter();
    };
    img.onerror = () => {
      loaded++;
      updateCounter();
    };
    img.src = `${folder}/${filename}`;
  }
}

function changeFolder() {
  const folderSelect = document.getElementById("folder");
  currentFolder = folderSelect.value;
  document.getElementById('randomImage').src = "";
  loadImagesFromFolder(currentFolder);
  setTimeout(() => showRandomImage(), 300);
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
      imageHistory.push(candidate);
      currentIndex = imageHistory.length - 1;
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
  imageHistory = [];
  currentIndex = -1;
  document.getElementById('randomImage').src = "";
  showRandomImage();
}

function showPreviousImage() {
  if (currentIndex > 0) {
    currentIndex--;
    const prevImage = imageHistory[currentIndex];
    document.getElementById('randomImage').src = prevImage;
  }
}

window.onload = () => {
  loadImagesFromFolder(currentFolder);
  setTimeout(() => {
    showRandomImage();
  }, 500);
};

let touchStartX = null;
document.addEventListener("touchstart", function (e) {
  touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener("touchend", function (e) {
  if (touchStartX === null) return;
  let touchEndX = e.changedTouches[0].screenX;
  let diffX = touchStartX - touchEndX;

  if (Math.abs(diffX) > 30) {
    if (diffX > 0) {
      showRandomImage();
    } else {
      showPreviousImage();
    }
  }
  touchStartX = null;
}, false);
