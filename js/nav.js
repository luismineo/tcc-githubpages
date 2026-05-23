document.addEventListener('DOMContentLoaded', () => {
  const navbar  = document.getElementById('navbar');
  const toggle  = document.querySelector('.nav-toggle');
  const navList = document.querySelector('.nav-links');
  const links   = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);

    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 80) current = sec.id;
    });
    links.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
    });
  }, { passive: true });

  toggle.addEventListener('click', () => {
    navList.classList.toggle('open');
  });

  links.forEach(a => {
    a.addEventListener('click', () => navList.classList.remove('open'));
  });
});
