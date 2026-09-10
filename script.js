/* ═══════════════════════════════════════════════
   YAAVA — script.js
   YouTube IFrame Player + Category Logic
═══════════════════════════════════════════════ */

// ── Playlist Configuration ─────────────────────
// Each key maps to the data-playlist-id in the HTML card.
// The values here are the fallback — HTML data attributes take priority.
const PLAYLISTS = {
  'cat-90s':      null,   // set via data-playlist-id in index.html
  'cat-punjabi':  null,
  'cat-gujarati': null,
  'cat-2000s':    null,
};

// ── State ──────────────────────────────────────
let player           = null;   // YT.Player instance
let activeCardId     = null;   // currently playing category id
let isShuffle        = false;
let progressTimer    = null;
let isPlayerReady    = false;
let pendingPlaylist  = null;   // playlist queued before player was ready

// ── DOM refs ───────────────────────────────────
const pillTitle    = document.getElementById('pillTitle');
const pillArtist   = document.getElementById('pillArtist');
const pillCover    = document.getElementById('pillCover');
const pillFill     = document.getElementById('pillFill');
const pillThumb    = document.getElementById('pillThumb');
const pillCurrent  = document.getElementById('pillCurrent');
const pillDuration = document.getElementById('pillDuration');
const pillPill     = document.getElementById('playerPill');
const btnPlay      = document.getElementById('btnPlay');
const btnPrev      = document.getElementById('btnPrev');
const btnNext      = document.getElementById('btnNext');
const btnShuffle   = document.getElementById('btnShuffle');
const pillRail     = document.getElementById('pillRail');
const navClock     = document.getElementById('navClock');

// ── Clock ──────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h   = String(now.getHours()).padStart(2, '0');
  const m   = String(now.getMinutes()).padStart(2, '0');
  navClock.textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 10000);

// ── YouTube IFrame API ─────────────────────────
// Load the YouTube IFrame API script dynamically
(function loadYTApi() {
  const tag = document.createElement('script');
  tag.src   = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();

// Called by YouTube API when ready
window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('yt-player', {
    height: '1',
    width:  '1',
    playerVars: {
      autoplay:       1,   // Must be 1 so loadPlaylist auto-starts
      controls:       0,
      disablekb:      1,
      fs:             0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel:            0,
      showinfo:       0,
      origin:         window.location.origin || 'http://localhost:8080',
    },
    events: {
      onReady:       onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError:       onPlayerError,
    },
  });
};

function onPlayerReady() {
  isPlayerReady = true;
  enableControls();
  console.log('[Yaava] YouTube player ready');
  // Play any playlist that was queued before the player was ready
  if (pendingPlaylist) {
    const { id, label } = pendingPlaylist;
    pendingPlaylist = null;
    loadAndPlay(id, label);
  }
}

function onPlayerStateChange(event) {
  const S = YT.PlayerState;

  if (event.data === S.PLAYING) {
    setPlayIcon(true);
    pillPill.classList.add('is-playing');
    startProgressTimer();
    updateSongMeta();

  } else if (event.data === S.PAUSED) {
    setPlayIcon(false);
    pillPill.classList.remove('is-playing');
    stopProgressTimer();

  } else if (event.data === S.ENDED) {
    setPlayIcon(false);
    pillPill.classList.remove('is-playing');
    stopProgressTimer();
    // Auto-play next song when one ends
    playNext();

  } else if (event.data === S.BUFFERING) {
    // keep current state
  }
}

function onPlayerError(event) {
  console.warn('[Yaava] YT Player error:', event.data);
  // skip to next on error
  setTimeout(playNext, 800);
}

// ── Controls ───────────────────────────────────
function enableControls() {
  [btnPlay, btnPrev, btnNext, btnShuffle].forEach(b => b.disabled = false);
}

function setPlayIcon(playing) {
  btnPlay.querySelector('.icon-play').style.display  = playing ? 'none' : '';
  btnPlay.querySelector('.icon-pause').style.display = playing ? ''     : 'none';
}

btnPlay.addEventListener('click', () => {
  if (!player || !isPlayerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
});

btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);

btnShuffle.addEventListener('click', () => {
  isShuffle = !isShuffle;
  btnShuffle.classList.toggle('active', isShuffle);
  if (player && isPlayerReady) {
    player.setShuffle(isShuffle);
  }
  btnShuffle.title = isShuffle ? 'Shuffle ON' : 'Shuffle OFF';
});

function playNext() {
  if (!player || !isPlayerReady) return;
  player.nextVideo();
  setTimeout(updateSongMeta, 600);
}

function playPrev() {
  if (!player || !isPlayerReady) return;
  player.previousVideo();
  setTimeout(updateSongMeta, 600);
}

// ── Progress Bar ───────────────────────────────
function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(tickProgress, 500);
}
function stopProgressTimer() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

function tickProgress() {
  if (!player || !isPlayerReady) return;
  try {
    const current  = player.getCurrentTime() || 0;
    const duration = player.getDuration()    || 0;
    const pct      = duration > 0 ? (current / duration) * 100 : 0;

    pillFill.style.width      = `${pct}%`;
    pillThumb.style.left      = `${pct}%`;
    pillRail.setAttribute('aria-valuenow', Math.round(pct));
    pillCurrent.textContent   = formatTime(current);
    pillDuration.textContent  = formatTime(duration);
  } catch(_) {}
}

// Seek on rail click
pillRail.addEventListener('click', (e) => {
  if (!player || !isPlayerReady) return;
  const rect     = pillRail.getBoundingClientRect();
  const pct      = (e.clientX - rect.left) / rect.width;
  const duration = player.getDuration() || 0;
  player.seekTo(pct * duration, true);
});

function formatTime(secs) {
  secs = Math.floor(secs || 0);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Song Meta ──────────────────────────────────
function updateSongMeta() {
  if (!player || !isPlayerReady) return;
  setTimeout(() => {
    try {
      const data   = player.getVideoData();
      const title  = data.title  || 'Now Playing';
      const author = data.author || '';

      pillTitle.textContent  = title;
      pillArtist.textContent = author || (activeCardId
        ? document.querySelector(`#${activeCardId} .cat-title`)?.textContent || ''
        : '');

      // Update cover thumb via oEmbed-like trick using YT video id
      const vid = data.video_id;
      if (vid) {
        const existingImg = pillCover.querySelector('img');
        if (existingImg) { existingImg.remove(); }
        const img      = document.createElement('img');
        img.src        = `https://i.ytimg.com/vi/${vid}/default.jpg`;
        img.alt        = 'Song thumbnail';
        img.onerror    = () => img.remove();
        pillCover.querySelector('.pill-cover-icon').style.display = 'none';
        pillCover.appendChild(img);
      }
    } catch(_) {}
  }, 300);
}

// ── Load & Play helper (called from card click OR from onPlayerReady) ────
function loadAndPlay(playlistId, label) {
  pillArtist.textContent = label;
  pillTitle.textContent  = 'Loading…';

  player.loadPlaylist({
    listType:     'playlist',
    list:         playlistId,
    index:        0,
    startSeconds: 0,
  });

  if (isShuffle) player.setShuffle(true);
  setTimeout(updateSongMeta, 1500);
}

// ── Category Cards ─────────────────────────────
const cards = document.querySelectorAll('.cat-card');

cards.forEach(card => {
  function activateCategory() {
    const playlistId = card.dataset.playlistId;

    // Guard: warn if placeholder not replaced
    if (!playlistId || playlistId.startsWith('YOUR_')) {
      showNoPlaylistWarning(card);
      return;
    }

    // Deactivate previous active card
    if (activeCardId) {
      document.getElementById(activeCardId)?.classList.remove('is-active');
    }
    activeCardId = card.id;
    card.classList.add('is-active');

    // Reset cover art
    const existingImg = pillCover.querySelector('img');
    if (existingImg) existingImg.remove();
    pillCover.querySelector('.pill-cover-icon').style.display = '';

    const label = card.dataset.label || '';

    if (!player || !isPlayerReady) {
      // Player not ready yet — queue the playlist
      pendingPlaylist = { id: playlistId, label };
      pillTitle.textContent  = 'Getting player ready…';
      pillArtist.textContent = label;
      return;
    }

    loadAndPlay(playlistId, label);

    // Scroll up to hero so the pill is visible
    document.getElementById('home').scrollIntoView({ behavior: 'smooth' });
  }

  card.addEventListener('click', activateCategory);

  // Keyboard: Enter / Space
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateCategory();
    }
  });
});

// ── No Playlist Warning ────────────────────────
function showNoPlaylistWarning(card) {
  // Remove old warning if any
  card.querySelector('.no-playlist-msg')?.remove();

  const msg = document.createElement('p');
  msg.className = 'no-playlist-msg';
  msg.textContent = '⚠️ Add your playlist ID in index.html';
  msg.style.cssText = `
    position:absolute; bottom:14px; left:50%; transform:translateX(-50%);
    background:rgba(220,60,60,0.85); color:#fff; font-size:0.75rem;
    padding:6px 14px; border-radius:8px; white-space:nowrap;
    backdrop-filter:blur(8px); z-index:10; pointer-events:none;
  `;
  card.style.position = 'relative';
  card.appendChild(msg);
  setTimeout(() => msg.remove(), 3500);
}

// ── Navbar scroll effect ───────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.style.background = window.scrollY > 40
    ? 'rgba(13,6,20,0.80)'
    : 'rgba(13,6,20,0.55)';
}, { passive: true });

// =====================================================
// YAAVA - AUTO SHAYARI
// =====================================================

(function () {

  const shayaris = [
    "तेरी मुस्कान में कुछ ऐसा जादू है, हर बार दिल फिर से तुझ पर आ जाता है। ❤️",
    "तुम पास हो तो हर लम्हा खूबसूरत लगता है, तुम दूर हो तो दिल तुम्हें ही ढूँढता है। 💕",
    "कुछ रिश्ते शब्दों से नहीं, दिल की धड़कनों से लिखे जाते हैं। 💖",
    "तेरे साथ बिताया हर पल, मेरी जिंदगी का सबसे प्यारा हिस्सा है। 🌹",
    "चाँद भी फीका लगता है तेरे चेहरे के सामने। ✨",
    "तुम्हारा नाम आते ही चेहरे पर मुस्कान आ जाती है। 🥰",
    "इश्क़ वो है जो दिल में हर पल महसूस किया जाए। ❤️",
    "तेरी आवाज़ सुनते ही दिल को सुकून मिलता है। 🎶",
    "मेरी हर दुआ में बस एक ही नाम है, और वो नाम तुम हो। 💞"
  ];

  // Find your existing subtitle
  const subtitle = document.querySelector('.hero-sub');

  if (!subtitle) {
    console.error("Yaava Shayari: .hero-sub not found");
    return;
  }

  // Create Shayari element
  const shayari = document.createElement('div');

  shayari.id = 'yaava-shayari';

  shayari.innerHTML = `
    <span class="shayari-small">♡ A little something for you ♡</span>
    <span class="shayari-text"></span>
  `;

  // Put Shayari DIRECTLY BELOW your subtitle
  subtitle.insertAdjacentElement('afterend', shayari);

  const text = shayari.querySelector('.shayari-text');

  let index = 0;

  text.textContent = shayaris[index];

  // Styling
  shayari.style.cssText = `
    width: 100%;
    max-width: 700px;
    margin: 18px auto 20px;
    text-align: center;
    padding: 12px 20px;
    box-sizing: border-box;
    position: relative;
    z-index: 5;
  `;

  const small = shayari.querySelector('.shayari-small');

  small.style.cssText = `
    display: block;
    margin-bottom: 7px;
    font-family: Inter, sans-serif;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.7;
  `;

  text.style.cssText = `
    display: block;
    font-family: "Playfair Display", serif;
    font-size: 18px;
    line-height: 1.6;
    font-style: italic;
    color: #ffffff;
    transition: opacity 0.35s ease;
  `;

  // Change Shayari every 2 seconds
  setInterval(function () {

    text.style.opacity = '0';

    setTimeout(function () {

      index++;

      if (index >= shayaris.length) {
        index = 0;
      }

      text.textContent = shayaris[index];
      text.style.opacity = '1';

    }, 300);

  }, 8000);

})();