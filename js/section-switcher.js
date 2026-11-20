for (const switcher of document.querySelectorAll('.section-switcher')) {
  const button = switcher.querySelector('.section-trigger');
  const links = switcher.querySelector('.section-links');

  if ('showPopover' in links) {
    const position = () => {
      const rect = button.getBoundingClientRect();
      const width = Math.min(208, document.documentElement.clientWidth - 24);
      const left = Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12));
      links.style.setProperty('--section-left', left + 'px');
      links.style.setProperty('--section-top', rect.bottom + 6 + 'px');
    };
    links.addEventListener('beforetoggle', event => {
      if (event.newState === 'open') position();
    });
    window.addEventListener('resize', () => {
      if (links.matches(':popover-open')) position();
    });
    continue;
  }

  switcher.dataset.fallback = '';
  function setOpen(open) {
    links.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  setOpen(false);
  button.addEventListener('click', () => setOpen(links.hidden));
  document.addEventListener('click', event => {
    if (!links.hidden && !switcher.contains(event.target)) setOpen(false);
  });
  switcher.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !links.hidden) {
      event.preventDefault();
      setOpen(false);
      button.focus();
    }
  });
}
