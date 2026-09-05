    /* ── Sticky nav scroll behaviour ── */
    const navbar  = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
      highlightActiveNav();
    }, { passive: true });

    /* ── Active nav link on scroll ── */
    function highlightActiveNav() {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.scrollY >= sectionTop) current = section.getAttribute('id');
      });
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
      });
    }

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

    /* ── IntersectionObserver — fade-in animations ── */
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); /* animate once */
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    /* ── Signup form — intercept and show inline confirmation ── */
    const signupForm    = document.getElementById('signupForm');
    const signupConfirm = document.getElementById('signupConfirm');

    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(signupForm);
        try {
          const res = await fetch(signupForm.action, {
            method: 'POST',
            body: data,
            headers: { Accept: 'application/json' }
          });
          if (res.ok) {
            signupForm.reset();
            signupConfirm.style.display = 'block';
            signupForm.querySelector('button[type=submit]').style.display = 'none';
          } else {
            alert('Something went wrong — please try again or email us directly.');
          }
        } catch {
          alert('Network error — please check your connection and try again.');
        }
      });
    }

    /* ── Contact form — same pattern ── */
    const contactForm    = document.getElementById('contactForm');
    const contactConfirm = document.getElementById('contactConfirm');

    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(contactForm);
        try {
          const res = await fetch(contactForm.action, {
            method: 'POST',
            body: data,
            headers: { Accept: 'application/json' }
          });
          if (res.ok) {
            contactForm.reset();
            contactConfirm.style.display = 'block';
            contactForm.querySelector('button[type=submit]').style.display = 'none';
          } else {
            alert('Something went wrong — please try again or email us directly.');
          }
        } catch {
          alert('Network error — please check your connection and try again.');
        }
      });
    }

    /* ── Notify me (shop) — local confirmation only, no form action needed ── */
    const notifyForm    = document.getElementById('notifyForm');
    const notifyConfirm = document.getElementById('notifyConfirm');

    if (notifyForm) {
      notifyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        notifyForm.style.display = 'none';
        notifyConfirm.style.display = 'block';
      });
    }

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
          const dateStr = toDateString(viewYear, viewMonth, d);
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'calendar-day';
          cell.textContent = d;

          if (dateStr === todayStr) cell.classList.add('today');

          const dayEvents = eventsByDate[dateStr];
          if (dayEvents) {
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
              <h5></h5>
              <p></p>
            </div>
          `;
          li.querySelector('h5').textContent = ev.title || '';
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
