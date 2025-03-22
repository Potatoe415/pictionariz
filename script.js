
let usedImages = new Set();

function getAllImages() {
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const folder = 'images/';
  const images = [];

  const allFiles = [
    'image1.jpg', 'Image2.PNG', 'photo3.jpeg', 'pic4.GIF', 'sample5.webp',
    'random6.JPG', 'Cool7.JPEG'
  ];

  allFiles.forEach(file => {
    const lower = file.toLowerCase();
    if (exts.some(ext => lower.endsWith(ext))) {
      images.push(folder + file);
    }
  });

  return images;
}

const imageList = getAllImages();

function showRandomImage() {
  const available = imageList.filter(img => !usedImages.has(img));
  if (available.length === 0) {
    alert("No more new images. Refresh the page or click Reset to start over.");
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
