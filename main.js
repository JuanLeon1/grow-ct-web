/* ── IntersectionObserver — fade-in animations ──
   Runs first, and only here do we hide the content: .js-animate is what
   makes .fade-in transparent (see styles.css). If anything below this
   block throws, the page still renders normally. */
document.documentElement.classList.add('js-animate');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); /* animate once */
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

/* ── Sticky nav shadow ── */
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ── Active nav link ──
   Only sections that actually have a nav link are tracked, so scrolling
   through Team or Contact leaves the previous link highlighted rather than
   clearing it. */
const navLinks   = document.querySelectorAll('.nav-links a');
const linkByHash = new Map([...navLinks].map(a => [a.getAttribute('href'), a]));

const tracked = [...document.querySelectorAll('section[id]')]
  .filter(section => linkByHash.has(`#${section.id}`));

const onScreen = new Set();

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) onScreen.add(entry.target);
    else onScreen.delete(entry.target);
  });

  const current = tracked.filter(section => onScreen.has(section)).pop();
  const activeLink = current ? linkByHash.get(`#${current.id}`) : null;
  navLinks.forEach(link => link.classList.toggle('active', link === activeLink));
}, { rootMargin: '-80px 0px -60% 0px' });

tracked.forEach(section => navObserver.observe(section));

/* ── Mobile hamburger toggle ── */
const navToggle = document.getElementById('navToggle');
const navLinksEl = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const open = navLinksEl.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
});

/* Close mobile nav when a link is clicked */
navLinksEl.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinksEl.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ── Formspree forms ──
   All three post the same way and differ only in what gets swapped out for
   the confirmation: the submit button for the long forms, the whole form for
   the inline shop one. That choice is `pickHideTarget`.

   Without JS the browser posts natively to the same action and Formspree
   shows its own thank-you page, so these handlers are an enhancement rather
   than the only path. */
function wireFormspreeForm(formId, confirmId, pickHideTarget) {
  const form    = document.getElementById(formId);
  const confirm = document.getElementById(confirmId);
  if (!form || !confirm) return;

  const button  = form.querySelector('button[type=submit]');
  const errorEl = document.getElementById(`${formId.replace(/Form$/, '')}Error`);

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.submitting) return; /* ignore double clicks */

    const label = button.textContent;
    form.dataset.submitting = 'true';
    button.disabled = true;
    button.textContent = 'Sending…';
    if (errorEl) errorEl.hidden = true;

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (!res.ok) {
        /* Formspree returns { errors: [{ code, message }] } for a bad form ID,
           a disabled form, or an exceeded submission quota. None of those are
           anything a visitor can act on, so the detail goes to the console and
           they get told how else to reach us. */
        const body = await res.json().catch(() => null);
        throw new Error(body?.errors?.map(err => err.message).join('; ')
          || `the form service returned ${res.status}`);
      }

      pickHideTarget(form).style.display = 'none';
      confirm.style.display = 'block';
      form.reset();
    } catch (err) {
      console.error(`${formId}: ${err.message}`);
      showError("Sorry — that didn't send. Please try again in a moment, or "
        + 'reach us at the email address in the Contact section.');
      button.disabled = false;
      button.textContent = label;
    } finally {
      delete form.dataset.submitting;
    }
  });
}

const submitButton = form => form.querySelector('button[type=submit]');
const wholeForm    = form => form;

wireFormspreeForm('signupForm',  'signupConfirm', submitButton);
wireFormspreeForm('contactForm', 'contactConfirm', submitButton);
wireFormspreeForm('notifyForm',  'notifyConfirm',  wholeForm);

/* ============================================================
   FUNDRAISING CALENDAR
   ------------------------------------------------------------
   HOW TO ADD, EDIT, OR REMOVE AN EVENT:
   Add, edit, or delete an entry in the FUNDRAISING_EVENTS list below.
   Each event looks like this:

     {
       date: '2026-10-18',                // YYYY-MM-DD — required
       title: 'Fall Plant Sale',           // required
       description: 'A short sentence about the event.',
       link: ''                            // optional — a URL for more info/RSVP
     },

   Save the file and the calendar + "Upcoming Events" list below it update
   automatically. Nothing else on the page needs to change.
============================================================ */
const FUNDRAISING_EVENTS = [
  // Example — delete this line and add your own events below it:
  // { date: '2026-10-18', title: 'Fall Plant Sale', description: 'Stop by our table at the Westport Farmers Market.', link: '' },
];

(function initFundraisingCalendar() {
  const grid       = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calMonthLabel');
  const eventsList = document.getElementById('eventsList');
  const prevBtn    = document.getElementById('calPrev');
  const nextBtn    = document.getElementById('calNext');

  if (!grid || !eventsList) return; // fundraising section not on this page

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const eventsByDate = {};
  FUNDRAISING_EVENTS.forEach(ev => {
    (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev);
  });

  const today = new Date();
  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-11

  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateString(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

  function renderCalendar() {
    monthLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;
    grid.innerHTML = '';

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr    = toDateString(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'calendar-day empty';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr   = toDateString(viewYear, viewMonth, d);
      const dayEvents = eventsByDate[dateStr];

      /* Only days with events do anything, so only those are buttons —
         otherwise a keyboard user tabs through the whole month. */
      const cell = document.createElement(dayEvents ? 'button' : 'div');
      cell.className = 'calendar-day';
      cell.textContent = d;

      if (dateStr === todayStr) cell.classList.add('today');

      if (dayEvents) {
        cell.type = 'button';
        cell.classList.add('has-event');
        cell.setAttribute('aria-label', `${d}: ${dayEvents.map(e => e.title).join(', ')}`);
        cell.addEventListener('click', () => {
          const target = eventsList.querySelector(`[data-date="${dateStr}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlight');
            setTimeout(() => target.classList.remove('highlight'), 1600);
          }
        });
      }

      grid.appendChild(cell);
    }
  }

  function renderEventsList() {
    eventsList.innerHTML = '';

    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const upcoming = FUNDRAISING_EVENTS
      .filter(ev => {
        const [y, m, d] = ev.date.split('-').map(Number);
        return new Date(y, m - 1, d) >= midnight;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length === 0) {
      eventsList.innerHTML = '<li class="events-empty">No upcoming events yet — check back soon!</li>';
      return;
    }

    upcoming.forEach(ev => {
      const [y, m, d] = ev.date.split('-').map(Number);
      const evDate = new Date(y, m - 1, d);
      const li = document.createElement('li');
      li.className = 'event-item';
      li.dataset.date = ev.date;
      li.innerHTML = `
        <div class="event-date-badge">
          <span class="event-date-month">${monthNames[evDate.getMonth()].slice(0, 3)}</span>
          <span class="event-date-day">${evDate.getDate()}</span>
        </div>
        <div class="event-item-body">
          <h4></h4>
          <p></p>
        </div>
      `;
      li.querySelector('h4').textContent = ev.title || '';
      li.querySelector('p').textContent = ev.description || '';
      if (ev.link) {
        const a = document.createElement('a');
        a.href = ev.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'More info';
        li.querySelector('.event-item-body').appendChild(a);
      }
      eventsList.appendChild(li);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderCalendar();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderCalendar();
    });
  }

  renderCalendar();
  renderEventsList();
})();
