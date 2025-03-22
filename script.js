
let usedImages = new Set();
let imageList = [];
let currentFolder = 'img_pictionariz';

const MAX_IMAGES = 100;
const maxRetries = 50;

function updateCounter() {
  document.getElementById('imageCount').innerText = imageList.length;
}

function loadImagesFromFolder(folder) {
  imageList = [];
  usedImages.clear();
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
  loadImagesFromFolder(currentFolder);
  setTimeout(() => {
    showRandomImage();
  }, 500);
};
