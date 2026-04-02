var logoBase = null;

function updateLogo() {
  var img = document.querySelector('[data-md-component="logo"] img');
  if (!img) return;
  if (!logoBase) {
    logoBase = img.src.substring(0, img.src.lastIndexOf('/') + 1);
  }
  var isDark = document.body.getAttribute('data-md-color-scheme') === 'slate';
  img.src = logoBase + (isDark ? 'jarvis-logo-dark.png' : 'jarvis-logo-light.png');
}

document$.subscribe(function () {
  updateLogo();

  new MutationObserver(updateLogo).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-md-color-scheme']
  });

  var navTitle = document.querySelector('.md-nav--primary .md-nav__title');
  if (navTitle) navTitle.textContent = 'Jarvis Embed';

  var logoLink = document.querySelector('[data-md-component="logo"]');
  if (logoLink) {
    logoLink.href = 'https://ascendingdc.com/jarvis-ai/jarvis-chat/';
    logoLink.target = '_blank';
    logoLink.rel = 'noopener';
  }

});
