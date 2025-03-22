
const images = [
  'images/image1.jpg',
  'images/image2.jpg',
  'images/image3.jpg'
  // Add more image paths here
];

function showRandomImage() {
  const img = document.getElementById('randomImage');
  const randomIndex = Math.floor(Math.random() * images.length);
  img.src = images[randomIndex];
}
