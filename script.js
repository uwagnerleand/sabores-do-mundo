const RECIPES_JSON_PATH = 'recipes.json';
const STORAGE_USER_RECIPES = 'saboresUsuarioReceitas';
const STORAGE_LOGGED_USER = 'saboresUsuarioLogado';
const STORAGE_USERS = 'saboresUsuarios';
const STORAGE_INTERACOES = 'saboresInteracoes';

const demoUsers = [
  { username: 'admin', password: 'admin123', displayName: 'Wagner Chef', role: 'chef', prestige: 42 },
  { username: 'usuario', password: 'receitas123', displayName: 'Ana Turista', role: 'turista', prestige: 18 }
];

let recipes = [];
let loggedUser = null;
let currentModalRecipeId = null;
let wizardType = null; // 'brasil' | 'mundo' | 'comemorativo'

const bodyPage = document.body.dataset.page || 'home';
const resultsContainer = document.getElementById('recipe-results');
const categoryResults = document.getElementById('category-results');
const filterTags = Array.from(document.querySelectorAll('.category-tag'));
const searchInput = document.querySelector('#search-input');
const searchButton = document.querySelector('#search-btn');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const recipeSubmitForm = document.querySelector('#recipe-submit-form');
const userPanel = document.querySelector('#logged-user-panel');
const loginError = document.querySelector('#login-error');
const registerError = document.querySelector('#register-error');
const recipeMessage = document.querySelector('#recipe-message');
const logoutButton = document.querySelector('#logout-btn');
const prestigeRanking = document.getElementById('prestige-ranking');
const communitySection = document.getElementById('community-section');
const userRoleDisplay = document.querySelector('#user-role');
const userPrestigeDisplay = document.querySelector('#prestige-score');

// --- Storage ---

function getStoredUsers() {
  const raw = localStorage.getItem(STORAGE_USERS);
  if (!raw) {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(demoUsers));
    return demoUsers;
  }
  try {
    const parsed = JSON.parse(raw);
    const users = Array.isArray(parsed) ? parsed : demoUsers;
    const normalized = users.map(u => ({ role: 'turista', prestige: 0, ...u }));
    localStorage.setItem(STORAGE_USERS, JSON.stringify(normalized));
    return normalized;
  } catch {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(demoUsers));
    return demoUsers;
  }
}

function getStoredRecipes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_USER_RECIPES) || '[]'); } catch { return []; }
}

function saveUserRecipes(arr) {
  localStorage.setItem(STORAGE_USER_RECIPES, JSON.stringify(arr));
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function getInteracoes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_INTERACOES) || '{}'); } catch { return {}; }
}

function saveInteracoes(data) {
  localStorage.setItem(STORAGE_INTERACOES, JSON.stringify(data));
}

// --- User helpers ---

function getUserByUsername(username) {
  return getStoredUsers().find(u => u.username === username) || null;
}

function awardPrestige(username, points) {
  const users = getStoredUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;
  user.prestige = Math.max(0, (user.prestige || 0) + points);
  saveUsers(users);
  return user;
}

function getLoggedUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_LOGGED_USER) || 'null'); }
  catch { localStorage.removeItem(STORAGE_LOGGED_USER); return null; }
}

function setLoggedUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_LOGGED_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_LOGGED_USER);
  }
  loggedUser = user;
  if (bodyPage === 'login' && user) {
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('redirect') || 'receitas.html';
    return;
  }
  updateUserPanel();
}

// --- Interactions ---

function getRecipeInteracoes(recipeId) {
  return getInteracoes()[recipeId] || { likes: [], ratings: [] };
}

function getRecipeLikeCount(recipeId) {
  return getRecipeInteracoes(recipeId).likes.length;
}

function userHasLiked(recipeId, username) {
  return getRecipeInteracoes(recipeId).likes.includes(username);
}

function getRecipeAvgRating(recipeId) {
  const ratings = getRecipeInteracoes(recipeId).ratings;
  if (!ratings.length) return null;
  return ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
}

function getUserRating(recipeId, username) {
  const found = getRecipeInteracoes(recipeId).ratings.find(r => r.user === username);
  return found ? found.score : null;
}

function getAuthorKey(recipe) {
  return recipe?.createdBy || recipe?.authorUsername || null;
}

function toggleLike(recipeId) {
  if (!loggedUser) return;
  const all = getInteracoes();
  if (!all[recipeId]) all[recipeId] = { likes: [], ratings: [] };
  const likes = all[recipeId].likes;
  const idx = likes.indexOf(loggedUser.username);
  const author = getAuthorKey(findRecipeById(recipeId));
  if (idx === -1) {
    likes.push(loggedUser.username);
    if (author && author !== loggedUser.username) awardPrestige(author, 2);
  } else {
    likes.splice(idx, 1);
    if (author && author !== loggedUser.username) awardPrestige(author, -2);
  }
  saveInteracoes(all);
  renderPrestigeRanking();
  renderCommunitySection();
}

function rateRecipe(recipeId, score) {
  if (!loggedUser) return null;
  const all = getInteracoes();
  if (!all[recipeId]) all[recipeId] = { likes: [], ratings: [] };
  const ratings = all[recipeId].ratings;
  const existingIdx = ratings.findIndex(r => r.user === loggedUser.username);
  const author = getAuthorKey(findRecipeById(recipeId));
  if (existingIdx >= 0) {
    ratings[existingIdx].score = score;
  } else {
    ratings.push({ user: loggedUser.username, score });
    if (score >= 4 && author && author !== loggedUser.username) awardPrestige(author, 3);
  }
  saveInteracoes(all);
  renderPrestigeRanking();
  renderCommunitySection();
}

// --- Community helpers ---

function getUserTotalLikesReceived(username) {
  const interacoes = getInteracoes();
  return recipes
    .filter(r => getAuthorKey(r) === username)
    .reduce((total, r) => total + (interacoes[r.id]?.likes?.length || 0), 0);
}

function getUserRecipeCount(username) {
  return recipes.filter(r => getAuthorKey(r) === username).length;
}

function getUserAvgRating(username) {
  const interacoes = getInteracoes();
  const allRatings = recipes
    .filter(r => getAuthorKey(r) === username)
    .flatMap(r => interacoes[r.id]?.ratings || []);
  if (!allRatings.length) return null;
  return allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length;
}

function getUserCommunityScore(user) {
  const likes = getUserTotalLikesReceived(user.username);
  const avg = getUserAvgRating(user.username) || 0;
  const count = getUserRecipeCount(user.username);
  return (user.prestige || 0) + likes * 2 + avg * 10 + count * 3;
}

// --- UI Rendering ---

function updateUserPanel() {
  if (bodyPage === 'login') return;

  const userBar = document.getElementById('user-bar');
  const guestBar = document.getElementById('guest-bar');
  const recipeFormWrapper = document.getElementById('recipe-form');

  if (!userBar && !guestBar) return;

  if (loggedUser) {
    if (userBar) userBar.classList.remove('hidden');
    if (guestBar) guestBar.classList.add('hidden');
    const nameEl = document.getElementById('logged-user-name');
    if (nameEl) nameEl.textContent = loggedUser.displayName || loggedUser.username;
    if (userRoleDisplay) userRoleDisplay.textContent = loggedUser.role === 'chef' ? 'Chef Culinário' : 'Turista Culinário';
    const fresh = getUserByUsername(loggedUser.username);
    if (userPrestigeDisplay) userPrestigeDisplay.textContent = `${fresh?.prestige ?? loggedUser.prestige ?? 0} pontos`;
  } else {
    if (userBar) userBar.classList.add('hidden');
    if (guestBar) guestBar.classList.remove('hidden');
    if (recipeFormWrapper) recipeFormWrapper.classList.add('hidden');
  }
}

function findRecipeById(id) {
  return recipes.find(r => String(r.id) === String(id));
}

function buildTagBadge(text) {
  return `<span class="inline-block bg-pink-50 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full">${text}</span>`;
}

function createRecipeCard(recipe) {
  const card = document.createElement('article');
  card.className = 'recipe-card group rounded-3xl overflow-hidden shadow-lg bg-white';
  card.dataset.country = recipe.country || '';
  card.dataset.region = recipe.region || '';
  card.dataset.occasion = recipe.occasion || '';

  const authorName = recipe.authorName || recipe.createdBy || 'Comunidade';
  const authorRole = recipe.authorRole === 'chef' ? 'Chef' : recipe.authorRole === 'turista' ? 'Turista' : '';
  const authorLabel = authorRole ? `${authorName} · ${authorRole}` : authorName;

  const likeCount = getRecipeLikeCount(recipe.id);
  const avg = getRecipeAvgRating(recipe.id);
  const ratingStr = avg !== null ? avg.toFixed(1) : '—';

  const tags = [recipe.country, recipe.region, recipe.occasion].filter(Boolean);

  card.innerHTML = `
    <img src="${recipe.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1280'}" alt="${recipe.alt || recipe.title}" class="rounded-t-3xl w-full h-48 object-cover" />
    <div class="p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>${recipe.difficulty || 'Média'}</span>
        <span>${recipe.time || 'N/A'}</span>
      </div>
      <h3 class="text-lg font-semibold text-slate-900">${recipe.title}</h3>
      <p class="text-xs text-slate-400">Por ${authorLabel}</p>
      <p class="text-sm leading-6 text-slate-600">${recipe.shortDescription || ''}</p>
      <div class="flex flex-wrap gap-1.5">
        ${tags.map(t => `<span class="text-[10px] bg-pink-50 text-pink-700 font-semibold px-2.5 py-1 rounded-full">${t}</span>`).join('')}
      </div>
      <div class="flex items-center gap-4 text-sm">
        <span class="card-likes flex items-center gap-1 font-semibold"><span>♥</span> ${likeCount}</span>
        <span class="card-rating flex items-center gap-1 font-semibold"><span>★</span> ${ratingStr}</span>
      </div>
      <button type="button" data-recipe-id="${recipe.id}" class="mt-auto rounded-full px-4 py-2 text-sm font-semibold transition ver-receita-btn">Ver receita</button>
    </div>
  `;

  card.querySelector('button').addEventListener('click', () => showRecipe(recipe.id));
  return card;
}

function renderRecipeCards() {
  if (resultsContainer) resultsContainer.innerHTML = '';
  if (categoryResults) categoryResults.innerHTML = '';
  recipes.forEach(recipe => {
    if (resultsContainer) resultsContainer.appendChild(createRecipeCard(recipe));
    if (categoryResults) categoryResults.appendChild(createRecipeCard(recipe));
  });
}

function renderPrestigeRanking() {
  if (!prestigeRanking) return;
  const users = getStoredUsers().slice().sort((a, b) => (b.prestige || 0) - (a.prestige || 0));
  prestigeRanking.innerHTML = '';
  users.slice(0, 3).forEach((user, i) => {
    const card = document.createElement('div');
    card.className = 'prestige-card rounded-3xl bg-white p-5 shadow-md';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <span class="font-semibold text-slate-800">${i + 1}. ${user.displayName || user.username}</span>
        <span class="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">${user.role === 'chef' ? 'Chef' : 'Turista'}</span>
      </div>
      <p class="text-3xl font-bold text-pink-600">${user.prestige || 0}</p>
      <p class="text-sm text-slate-400 mt-1">Prestígio culinário acumulado</p>
    `;
    prestigeRanking.appendChild(card);
  });
}

function renderCommunitySection() {
  if (!communitySection) return;
  const users = getStoredUsers();
  const chefs = users.filter(u => u.role === 'chef').sort((a, b) => getUserCommunityScore(b) - getUserCommunityScore(a));
  const turistas = users.filter(u => u.role === 'turista').sort((a, b) => getUserCommunityScore(b) - getUserCommunityScore(a));
  const medals = ['🥇', '🥈', '🥉'];

  function buildCards(list) {
    if (!list.length) return '<p class="text-slate-400 col-span-3 text-center py-8">Nenhum usuário nesta categoria ainda.</p>';
    return list.slice(0, 3).map((user, i) => {
      const likes = getUserTotalLikesReceived(user.username);
      const avg = getUserAvgRating(user.username);
      const count = getUserRecipeCount(user.username);
      const initial = (user.displayName || user.username)[0].toUpperCase();
      return `
        <div class="community-card rounded-3xl bg-white p-6 shadow-md">
          <div class="flex items-center gap-4 mb-4">
            <div class="community-avatar">${initial}</div>
            <div>
              <p class="font-bold text-slate-800">${medals[i] || ''} ${user.displayName || user.username}</p>
              <p class="text-xs text-slate-400 mt-0.5">${user.role === 'chef' ? 'Chef Culinário' : 'Turista Culinário'}</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-pink-50 rounded-2xl p-3">
              <p class="font-bold text-pink-600 text-lg">${user.prestige || 0}</p>
              <p class="text-xs text-slate-500 mt-0.5">Prestígio</p>
            </div>
            <div class="bg-amber-50 rounded-2xl p-3">
              <p class="font-bold text-amber-500 text-lg">${avg !== null ? avg.toFixed(1) + '★' : '—'}</p>
              <p class="text-xs text-slate-500 mt-0.5">Avaliação</p>
            </div>
            <div class="bg-rose-50 rounded-2xl p-3">
              <p class="font-bold text-rose-500 text-lg">♥ ${likes}</p>
              <p class="text-xs text-slate-500 mt-0.5">Curtidas</p>
            </div>
          </div>
          <p class="text-xs text-slate-400 mt-4 text-center">${count} receita${count !== 1 ? 's' : ''} compartilhada${count !== 1 ? 's' : ''}</p>
        </div>
      `;
    }).join('');
  }

  const chefsGrid = communitySection.querySelector('#community-chefs');
  const turistasGrid = communitySection.querySelector('#community-turistas');
  if (chefsGrid) chefsGrid.innerHTML = buildCards(chefs);
  if (turistasGrid) turistasGrid.innerHTML = buildCards(turistas);
}

// --- Modal ---

function showRecipe(recipeId) {
  const recipe = findRecipeById(recipeId);
  if (!recipe) return;
  currentModalRecipeId = recipeId;
  const detail = document.getElementById('recipe-detail');
  if (!detail) return;

  detail.querySelector('[data-template-id="detail-img"]').src = recipe.image || '';
  detail.querySelector('[data-template-id="detail-img"]').alt = recipe.alt || recipe.title;
  detail.querySelector('[data-template-id="detail-title"]').textContent = recipe.title;
  detail.querySelector('[data-template-id="detail-time"]').textContent = recipe.time || '';
  detail.querySelector('[data-template-id="detail-difficulty"]').textContent = recipe.difficulty || '';
  detail.querySelector('[data-template-id="detail-ingredients"]').textContent = recipe.ingredients || '';
  detail.querySelector('[data-template-id="detail-steps"]').textContent = recipe.steps || '';

  const authorName = recipe.authorName || recipe.createdBy || 'Comunidade';
  const authorRole = recipe.authorRole === 'chef' ? 'Chef Culinário' : recipe.authorRole === 'turista' ? 'Turista Culinário' : '';
  const authorEl = detail.querySelector('[data-template-id="detail-author"]');
  if (authorEl) authorEl.textContent = authorRole ? `${authorName} · ${authorRole}` : authorName;

  const tagsEl = detail.querySelector('[data-template-id="detail-tags"]');
  if (tagsEl) {
    const tags = [recipe.country, recipe.region, recipe.occasion].filter(Boolean);
    tagsEl.innerHTML = tags.map(t => buildTagBadge(t)).join('');
  }

  updateModalInteractions(recipeId);
  detail.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function updateModalInteractions(recipeId) {
  const detail = document.getElementById('recipe-detail');
  if (!detail) return;

  const likeCount = getRecipeLikeCount(recipeId);
  const hasLiked = loggedUser ? userHasLiked(recipeId, loggedUser.username) : false;
  const avg = getRecipeAvgRating(recipeId);
  const userScore = loggedUser ? getUserRating(recipeId, loggedUser.username) : null;
  const recipe = findRecipeById(recipeId);
  const isOwn = loggedUser && getAuthorKey(recipe) === loggedUser.username;

  const likeBtn = detail.querySelector('#modal-like-btn');
  const likeCountEl = detail.querySelector('#modal-like-count');
  const avgEl = detail.querySelector('#modal-avg-rating');
  const starsEl = detail.querySelector('#modal-stars');
  const ratingSection = detail.querySelector('#modal-rating-section');

  if (likeBtn) {
    likeBtn.textContent = hasLiked ? '♥ Curtiu' : '♡ Curtir';
    likeBtn.classList.toggle('liked', hasLiked);
    likeBtn.disabled = !loggedUser || isOwn;
    likeBtn.title = !loggedUser ? 'Faça login para curtir' : isOwn ? 'Você não pode curtir sua própria receita' : '';
  }
  if (likeCountEl) likeCountEl.textContent = likeCount;
  if (avgEl) avgEl.textContent = avg !== null ? `${avg.toFixed(1)} ★` : 'Sem avaliações';

  if (starsEl) {
    starsEl.innerHTML = [1, 2, 3, 4, 5].map(n => `
      <button type="button" class="star-btn ${userScore !== null && userScore >= n ? 'active' : ''}" data-score="${n}" ${(!loggedUser || isOwn) ? 'disabled' : ''}>★</button>
    `).join('');
    starsEl.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        rateRecipe(currentModalRecipeId, parseInt(btn.dataset.score));
        updateModalInteractions(currentModalRecipeId);
      });
      btn.addEventListener('mouseenter', () => {
        const score = parseInt(btn.dataset.score);
        starsEl.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('hover', parseInt(b.dataset.score) <= score));
      });
      btn.addEventListener('mouseleave', () => {
        starsEl.querySelectorAll('.star-btn').forEach(b => b.classList.remove('hover'));
      });
    });
  }

  if (ratingSection) ratingSection.style.display = !loggedUser || isOwn ? 'none' : '';
}

function hideRecipe() {
  const detail = document.getElementById('recipe-detail');
  if (!detail) return;
  detail.classList.remove('visible');
  document.body.style.overflow = '';
  currentModalRecipeId = null;
}

// --- Auth ---

function handleLogin(event) {
  event.preventDefault();
  if (!loginForm) return;
  const username = loginForm.querySelector('#login-username')?.value.trim();
  const password = loginForm.querySelector('#login-password')?.value.trim();
  if (!username || !password) {
    if (loginError) loginError.textContent = 'Preencha usuário e senha.';
    return;
  }
  const user = getStoredUsers().find(u => u.username === username && u.password === password);
  if (!user) {
    if (loginError) loginError.textContent = 'Usuário ou senha inválidos.';
    return;
  }
  setLoggedUser(user);
  if (loginError) loginError.textContent = '';
  loginForm.reset();
}

function handleRegister(event) {
  event.preventDefault();
  if (!registerForm) return;
  const username = registerForm.querySelector('#reg-username')?.value.trim();
  const displayName = registerForm.querySelector('#reg-displayname')?.value.trim();
  const password = registerForm.querySelector('#reg-password')?.value.trim();
  const role = registerForm.querySelector('#reg-role')?.value || 'turista';
  if (!username || !displayName || !password) {
    if (registerError) registerError.textContent = 'Preencha todos os campos.';
    return;
  }
  if (username.length < 3) {
    if (registerError) registerError.textContent = 'Usuário deve ter ao menos 3 caracteres.';
    return;
  }
  const users = getStoredUsers();
  if (users.find(u => u.username === username)) {
    if (registerError) registerError.textContent = 'Esse usuário já existe. Escolha outro.';
    return;
  }
  const newUser = { username, displayName, password, role, prestige: 0 };
  users.push(newUser);
  saveUsers(users);
  setLoggedUser(newUser);
  if (registerError) registerError.textContent = '';
  registerForm.reset();
}

function handleLogout() {
  setLoggedUser(null);
}

function handleRecipeSubmit(event) {
  event.preventDefault();
  if (!recipeSubmitForm || !loggedUser) return;

  const country = document.getElementById('wizard-country')?.value?.trim();
  const region = document.getElementById('wizard-region')?.value?.trim() || '';
  const wizardOccasion = document.getElementById('wizard-occasion')?.value?.trim();
  const wizardError = document.getElementById('wizard-error');

  if (!country) {
    if (wizardError) wizardError.textContent = 'Selecione o tipo da receita antes de continuar.';
    document.getElementById('recipe-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const fd = new FormData(recipeSubmitForm);
  const occasion = wizardType === 'comemorativo'
    ? (wizardOccasion || 'Comemorativo')
    : (fd.get('mealType')?.toString() || 'Prato principal');

  const newRecipe = {
    id: `user-${Date.now()}`,
    title: fd.get('title')?.toString().trim() || 'Nova receita',
    category: wizardType === 'comemorativo' ? 'Comemorativo' : 'Outro',
    country,
    region,
    occasion,
    image: fd.get('image')?.toString().trim() || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1280',
    alt: fd.get('alt')?.toString().trim() || '',
    time: fd.get('time')?.toString().trim() || 'N/A',
    difficulty: fd.get('difficulty')?.toString() || 'Baixa',
    shortDescription: fd.get('shortDescription')?.toString().trim() || '',
    ingredients: fd.get('ingredients')?.toString().trim() || '',
    steps: fd.get('steps')?.toString().trim() || '',
    createdBy: loggedUser.username,
    authorUsername: loggedUser.username,
    authorName: loggedUser.displayName || loggedUser.username,
    authorRole: loggedUser.role
  };

  const stored = getStoredRecipes();
  stored.push(newRecipe);
  saveUserRecipes(stored);
  recipes.unshift(newRecipe);

  const points = loggedUser.role === 'chef' ? 8 : 4;
  const updated = awardPrestige(loggedUser.username, points);
  if (updated) setLoggedUser(updated);

  renderRecipeCards();
  renderPrestigeRanking();
  renderCommunitySection();
  recipeSubmitForm.reset();
  resetRecipeWizard();
  const recipeFormWrapper = document.getElementById('recipe-form');
  if (recipeFormWrapper) recipeFormWrapper.classList.add('hidden');

  if (recipeMessage) {
    recipeMessage.textContent = `Receita enviada! +${points} pontos de prestígio.`;
    setTimeout(() => { if (recipeMessage) recipeMessage.textContent = ''; }, 4000);
  }
}

// --- Filters ---

const activeFilters = { country: null, region: null, occasion: null };

function getRecipeCards() {
  return Array.from(document.querySelectorAll('.recipe-card'));
}

function filterCards(scrollToResults = false) {
  const query = searchInput?.value.trim().toLowerCase() || '';
  getRecipeCards().forEach(card => {
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const desc = card.querySelector('.text-sm.leading-6')?.textContent.toLowerCase() || '';
    const country = card.dataset.country?.toLowerCase() || '';
    const region = card.dataset.region?.toLowerCase() || '';
    const occasion = card.dataset.occasion?.toLowerCase() || '';
    const matchesSearch = !query || [title, desc, country, region, occasion].some(s => s.includes(query));
    const matchesCountry = !activeFilters.country || country === activeFilters.country.toLowerCase();
    const matchesRegion = !activeFilters.region || region === activeFilters.region.toLowerCase();
    const matchesOccasion = !activeFilters.occasion || occasion === activeFilters.occasion.toLowerCase();
    card.style.display = matchesSearch && matchesCountry && matchesRegion && matchesOccasion ? '' : 'none';
  });
  const noMsg = document.getElementById('no-results-msg');
  if (noMsg) {
    const hasVisible = getRecipeCards().some(c => c.style.display !== 'none');
    noMsg.classList.toggle('hidden', hasVisible);
  }
  if (scrollToResults) {
    const section = document.getElementById('recipe-results-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateFilterButtons() {
  filterTags.forEach(tag => {
    const group = tag.dataset.group;
    if (!group) return;
    tag.classList.toggle('active', activeFilters[group] === tag.dataset.value);
  });
}

function handleFilterTagClick(tag) {
  const group = tag.dataset.group;
  const value = tag.dataset.value;
  if (!group || !value) return;
  activeFilters[group] = activeFilters[group] === value ? null : value;
  updateFilterButtons();
  filterCards();
}

const FALLBACK_RECIPES = [
  {
    "id": 1,
    "title": "Bolo de fubá com coco fofinho",
    "category": "Pão e bolos",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Lanche",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/9/8/1/bolo_de_fuba_com_coco_fofinho_7189_300_square.webp",
    "alt": "Bolo de fubá com coco fofinho",
    "time": "45 min",
    "difficulty": "Baixa",
    "shortDescription": "Bolo de fubá macio com coco, perfeito para o café ou lanche.",
    "ingredients": "• 2 xícaras de fubá\n• 1 xícara de coco ralado\n• 3 ovos\n• 1 xícara de leite\n• 1/2 xícara de óleo\n• 1 xícara de açúcar\n• 1 colher de sopa de fermento",
    "steps": "1. Misture os ingredientes secos.\n2. Junte ovos, leite e óleo.\n3. Adicione o coco e o fermento.\n4. Asse por 35-40 minutos.\n5. Deixe esfriar e sirva.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 2,
    "title": "Vatapá de peixe simples",
    "category": "Comida de panela",
    "country": "Brasil",
    "region": "Nordeste",
    "occasion": "Prato principal",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/9/0/9/vatapa_de_peixe_simples_5909_300_square.webp",
    "alt": "Vatapá de peixe simples",
    "time": "30 min",
    "difficulty": "Baixa",
    "shortDescription": "Vatapá cremoso de peixe, uma receita nordestina muito saborosa.",
    "ingredients": "• 500g de peixe\n• 1 cebola\n• 2 tomates\n• 200ml de leite de coco\n• Azeite de dendê\n• Pão amanhecido\n• Amendoim e castanha",
    "steps": "1. Refogue cebola e tomate.\n2. Adicione o peixe e deixe cozinhar.\n3. Misture leite de coco e dendê.\n4. Acrescente pão, amendoim e castanhas.\n5. Cozinhe até ficar cremoso.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 3,
    "title": "Maria Mole de liquidificador",
    "category": "Sobremesas",
    "country": "Brasil",
    "region": "Nordeste",
    "occasion": "Festa Junina",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/7/7/2/maria_mole_de_liquidificador_277_300_square.webp",
    "alt": "Maria Mole de liquidificador",
    "time": "3h",
    "difficulty": "Baixa",
    "shortDescription": "Doce gelado de coco com textura leve, ideal para festas juninas.",
    "ingredients": "• 1 lata de leite condensado\n• 1 lata de leite de coco\n• 1 pacote de coco ralado\n• 1 envelope de gelatina sem sabor\n• Açúcar a gosto\n• Coco para polvilhar",
    "steps": "1. Hidrate a gelatina.\n2. Bata todos os ingredientes no liquidificador.\n3. Coloque em forma untada.\n4. Leve à geladeira por 3 horas.\n5. Sirva com coco ralado.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 4,
    "title": "Costelinha de porco frita",
    "category": "Carne",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Jantar",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/1/2/0/costelinha_de_porco_frita_21_300_square.webp",
    "alt": "Costelinha de porco frita",
    "time": "45 min",
    "difficulty": "Baixa",
    "shortDescription": "Costelinha crocante e temperada, perfeita para um jantar saboroso.",
    "ingredients": "• 1kg de costelinha de porco\n• Alho, cebola e sal\n• Pimenta-do-reino\n• Óleo para fritar\n• Cheiro-verde a gosto",
    "steps": "1. Tempere a costelinha com alho, cebola e sal.\n2. Deixe descansar por 30 minutos.\n3. Frite em óleo quente até dourar.\n4. Escorra o excesso de óleo.\n5. Sirva com cheiro-verde.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 5,
    "title": "Bobó de frango com mandioca",
    "category": "Comida de panela",
    "country": "Brasil",
    "region": "Nordeste",
    "occasion": "Prato principal",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/8/8/1/bobo_de_frango_com_mandioca_simples_7188_300_square.webp",
    "alt": "Bobó de frango com mandioca simples",
    "time": "45 min",
    "difficulty": "Baixa",
    "shortDescription": "Bobó cremoso com frango e mandioca, uma receita caseira brasileira.",
    "ingredients": "• 500g de frango\n• 500g de mandioca\n• 200ml de leite de coco\n• Azeite de dendê\n• Cebola e alho\n• Coentro e pimenta",
    "steps": "1. Cozinhe o frango e desfie.\n2. Cozinhe a mandioca e faça um purê.\n3. Refogue cebola e alho.\n4. Junte o frango, o purê e o leite de coco.\n5. Tempere e sirva.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 6,
    "title": "Rabada no tucupi",
    "category": "Carne",
    "country": "Brasil",
    "region": "Norte",
    "occasion": "Jantar",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/2/9/0/rabada_no_tucupi_3092_300_square.webp",
    "alt": "Rabada no tucupi",
    "time": "4h",
    "difficulty": "Baixa",
    "shortDescription": "Rabada cozida no caldo de tucupi, prato típico da região Norte.",
    "ingredients": "• 1kg de rabada\n• 500ml de tucupi\n• Jambu\n• Alho e cebola\n• Pimenta-de-cheiro\n• Sal e cheiro-verde",
    "steps": "1. Cozinhe a rabada até ficar macia.\n2. Prepare o tucupi e o jambu.\n3. Misture a carne ao tucupi.\n4. Adicione pimenta e temperos.\n5. Sirva quente.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 7,
    "title": "Pintado ensopado",
    "category": "Peixe",
    "country": "Brasil",
    "region": "Centro-Oeste",
    "occasion": "Prato principal",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/8/6/0/pintado_ensopado_2068_300_square.webp",
    "alt": "Pintado ensopado",
    "time": "30 min",
    "difficulty": "Baixa",
    "shortDescription": "Ensopado de pintado, peixe suave típico das águas doces brasileiras.",
    "ingredients": "• 1kg de pintado\n• 2 tomates\n• 1 cebola\n• Coentro\n• Leite de coco\n• Pimenta e sal",
    "steps": "1. Tempere o peixe e reserve.\n2. Refogue cebola e tomate.\n3. Acrescente o peixe e o leite de coco.\n4. Cozinhe até o molho engrossar.\n5. Sirva com arroz branco.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 8,
    "title": "Bolo prestígio bem fofinho",
    "category": "Pão e bolos",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Sobremesa",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/6/7/2/bolo_prestigio_bem_fofinho_276_300_square.webp",
    "alt": "Bolo prestígio bem fofinho",
    "time": "1h 30m",
    "difficulty": "Média",
    "shortDescription": "Bolo de chocolate recheado com leite condensado e coco, super macio.",
    "ingredients": "• 3 ovos\n• 2 xícaras de açúcar\n• 2 xícaras de farinha\n• 1 xícara de chocolate em pó\n• 1 lata de leite condensado\n• 1 lata de creme de leite\n• Coco ralado",
    "steps": "1. Bata ovos, açúcar e óleo.\n2. Misture a farinha e o chocolate.\n3. Asse por 35-40 minutos.\n4. Recheie com creme de leite condensado e coco.\n5. Cubra com chocolate e sirva.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 9,
    "title": "Vaca atolada mineira",
    "category": "Carne",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Domingo",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/0/2/0/vaca_atolada_mineira_20_300_square.webp",
    "alt": "Vaca atolada mineira",
    "time": "2h 30m",
    "difficulty": "Média",
    "shortDescription": "Ensopado de costela e mandioca, prato típico e reconfortante de Minas.",
    "ingredients": "• 1kg de costela bovina\n• 500g de mandioca\n• 3 tomates\n• 1 cebola\n• Cheiro-verde\n• Sal e pimenta",
    "steps": "1. Cozinhe a costela até amaciar.\n2. Adicione a mandioca e os temperos.\n3. Deixe cozinhar até desmanchar.\n4. Ajuste o sal e a pimenta.\n5. Sirva quente.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 10,
    "title": "Panelada de boi",
    "category": "Carne",
    "country": "Brasil",
    "region": "Norte",
    "occasion": "Prato principal",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/1/9/0/panelada_de_boi_3091_300_square.webp",
    "alt": "Panelada de boi",
    "time": "4h",
    "difficulty": "Média",
    "shortDescription": "Cozido de mocotó e vísceras, prato típico do Norte brasileiro.",
    "ingredients": "• Mocotó e bucho de boi\n• 2 cebolas\n• 3 dentes de alho\n• Louro\n• Pimenta-do-reino\n• Sal",
    "steps": "1. Limpe e corte o mocotó e as vísceras.\n2. Cozinhe com temperos por horas.\n3. Adicione água conforme necessário.\n4. Ajuste sal e pimenta.\n5. Sirva bem quente.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 11,
    "title": "Sagu",
    "category": "Sobremesas",
    "country": "Brasil",
    "region": "Sul",
    "occasion": "Festa Junina",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/5/7/2/sagu_275_300_square.webp",
    "alt": "Sagu",
    "time": "1h 30m",
    "difficulty": "Baixa",
    "shortDescription": "Doce de sagu com creme, típico para festas juninas e sobremesas.",
    "ingredients": "• 250g de sagu\n• 1 litro de água\n• 1 lata de leite condensado\n• 1 lata de creme de leite\n• Canela em pau",
    "steps": "1. Cozinhe o sagu até ficar transparente.\n2. Prepare o creme com leite condensado.\n3. Misture o sagu no creme.\n4. Deixe esfriar na geladeira.\n5. Sirva com canela.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 12,
    "title": "Carne louca para festa",
    "category": "Carne",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Aniversários",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/4/7/2/carne_louca_para_festa_274_300_square.webp",
    "alt": "Carne louca para festa",
    "time": "2h 30m",
    "difficulty": "Média",
    "shortDescription": "Carne desfiada ao molho, ótima para festas, sanduíches e lanches.",
    "ingredients": "• 1kg de carne bovina\n• 3 tomates\n• 1 cebola\n• Pimentão\n• Molho de tomate\n• Temperos a gosto",
    "steps": "1. Cozinhe a carne até desfiar.\n2. Refogue cebola, tomate e pimentão.\n3. Junte a carne desfiada e o molho.\n4. Deixe apurar por 20 minutos.\n5. Sirva quente.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 13,
    "title": "Frango à passarinho de boteco",
    "category": "Aves e caça",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Petisco",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/8/1/0/frango_a_passarinho_de_boteco_18_300_square.webp",
    "alt": "Frango à passarinho de boteco",
    "time": "45 min",
    "difficulty": "Baixa",
    "shortDescription": "Frango crocante de boteco, perfeito para petiscos e happy hour.",
    "ingredients": "• 1kg de frango à passarinho\n• Alho e sal\n• Pimenta-do-reino\n• Limão\n• Óleo para fritar",
    "steps": "1. Tempere o frango com alho, sal, pimenta e limão.\n2. Deixe marinar por 30 minutos.\n3. Frite em óleo quente até dourar.\n4. Escorra o óleo.\n5. Sirva com limão.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 14,
    "title": "Pão de queijo com bacon",
    "category": "Pão e bolos",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Café da manhã",
    "image": "https://cdn0.tudoreceitas.com/pt/posts/3/5/3/pao_de_queijo_com_bacon_4353_300_square.webp",
    "alt": "Pão de queijo com bacon",
    "time": "45 min",
    "difficulty": "Baixa",
    "shortDescription": "Pão de queijo cremoso com pedaços de bacon crocante.",
    "ingredients": "• 500g de polvilho doce\n• 200g de queijo\n• 150g de bacon\n• 2 ovos\n• 100ml de leite\n• 100ml de óleo",
    "steps": "1. Frite o bacon até ficar crocante.\n2. Misture polvilho, queijo, ovos e leite.\n3. Adicione o bacon.\n4. Modele bolinhas.\n5. Asse por 20 minutos.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 15,
    "title": "Tacos de frango ao limão",
    "category": "Comida de rua",
    "country": "México",
    "region": "",
    "occasion": "Petisco",
    "image": "https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Tacos de frango ao limão",
    "time": "30 min",
    "difficulty": "Baixa",
    "shortDescription": "Tacos crocantes com frango temperado ao limão, coentro e cebola roxa.",
    "ingredients": "• 500g de peito de frango\n• 8 tortilhas de milho\n• 2 limas\n• 1 colher de cominho\n• Páprica defumada\n• Cebola roxa fatiada\n• Coentro fresco\n• Molho de pimenta",
    "steps": "1. Tempere o frango com cominho, páprica, sal e suco de lima.\n2. Grelhe até dourar e corte em tiras.\n3. Aqueça as tortilhas.\n4. Monte os tacos com frango, cebola e coentro.\n5. Sirva com molho de pimenta e mais lima.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 16,
    "title": "Pasta carbonara clássica",
    "category": "Massas",
    "country": "Itália",
    "region": "",
    "occasion": "Jantar",
    "image": "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Pasta carbonara clássica",
    "time": "25 min",
    "difficulty": "Média",
    "shortDescription": "A autêntica carbonara italiana com guanciale, ovo e pecorino, sem creme.",
    "ingredients": "• 400g de espaguete\n• 150g de guanciale (ou bacon)\n• 4 gemas\n• 100g de pecorino romano ralado\n• Pimenta-do-reino a gosto\n• Sal",
    "steps": "1. Cozinhe o macarrão al dente.\n2. Frite o guanciale até crocante.\n3. Misture gemas com o queijo e pimenta.\n4. Retire o macarrão e misture com o guanciale fora do fogo.\n5. Adicione a mistura de ovos e mexa rápido. Sirva imediatamente.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 17,
    "title": "Ramen de frango caseiro",
    "category": "Sopas",
    "country": "Japão",
    "region": "",
    "occasion": "Jantar",
    "image": "https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Ramen de frango caseiro",
    "time": "1h 30m",
    "difficulty": "Média",
    "shortDescription": "Caldo rico de frango com macarrão, ovo marinado, nori e cebolinha.",
    "ingredients": "• 1 carcaça de frango\n• 200g de macarrão ramen\n• 4 ovos\n• Shoyu\n• Gengibre e alho\n• Nori (alga)\n• Cebolinha\n• Óleo de gergelim",
    "steps": "1. Ferva a carcaça com gengibre e alho por 1h para o caldo.\n2. Marine os ovos cozidos em shoyu por 30 min.\n3. Cozinhe o macarrão e reserve.\n4. Monte a tigela com macarrão, caldo quente.\n5. Finalize com ovo, nori, cebolinha e óleo de gergelim.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 18,
    "title": "Crêpes doces com nutella",
    "category": "Sobremesas",
    "country": "França",
    "region": "",
    "occasion": "Café da manhã",
    "image": "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Crêpes doces com nutella",
    "time": "20 min",
    "difficulty": "Baixa",
    "shortDescription": "Crêpes finos e delicados recheados com nutella e morango fresco.",
    "ingredients": "• 1 xícara de farinha\n• 2 ovos\n• 1 xícara de leite\n• 1 colher de manteiga\n• 1 pitada de sal\n• Nutella a gosto\n• Morangos frescos",
    "steps": "1. Misture farinha, ovos, leite e sal até ficar liso.\n2. Deixe a massa descansar 15 minutos.\n3. Unte a frigideira com manteiga e despeje uma concha de massa.\n4. Cozinhe 1 minuto de cada lado.\n5. Recheie com nutella e morangos. Dobre e sirva.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 19,
    "title": "Empanadas argentinas de carne",
    "category": "Salgados",
    "country": "Argentina",
    "region": "",
    "occasion": "Petisco",
    "image": "https://images.pexels.com/photos/6605208/pexels-photo-6605208.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Empanadas argentinas de carne",
    "time": "1h",
    "difficulty": "Média",
    "shortDescription": "Pastéis assados recheados com carne bovina, ovo cozido e azeitonas.",
    "ingredients": "• 500g de carne moída\n• Massa de empanada (ou massa podre)\n• 2 ovos cozidos\n• Azeitonas verdes\n• Cebola, pimentão e cominho\n• Páprica e sal",
    "steps": "1. Refogue cebola, pimentão e carne com especiarias.\n2. Misture com ovo cozido picado e azeitonas.\n3. Abra a massa e recorte círculos.\n4. Recheie, feche e pressione as bordas.\n5. Asse a 200°C por 20 minutos até dourar.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 20,
    "title": "Acarajé baiano tradicional",
    "category": "Comida de rua",
    "country": "Brasil",
    "region": "Nordeste",
    "occasion": "Petisco",
    "image": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Acarajé baiano",
    "time": "2h",
    "difficulty": "Alta",
    "shortDescription": "Bolinho de feijão fradinho frito no dendê, recheado com vatapá e camarão.",
    "ingredients": "• 500g de feijão fradinho (demolhado)\n• Camarão seco\n• Vatapá pronto\n• Azeite de dendê\n• Cebola\n• Sal e pimenta-de-cheiro\n• Vinagrete de tomate",
    "steps": "1. Bata o feijão no liquidificador com cebola e sal até virar massa.\n2. Bata bem a massa até ficar aerada.\n3. Frite colheradas no dendê quente até dourar.\n4. Corte ao meio e recheie com vatapá.\n5. Finalize com camarão e vinagrete.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 21,
    "title": "Rabanada natalina",
    "category": "Sobremesas",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Natal",
    "image": "https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Rabanada natalina",
    "time": "30 min",
    "difficulty": "Baixa",
    "shortDescription": "Fatias de pão frito empanadas em ovo e leite, cobertas com açúcar e canela.",
    "ingredients": "• 1 pão francês do dia anterior\n• 2 ovos\n• 1 xícara de leite\n• Açúcar e canela em pó\n• Óleo para fritar\n• Essência de baunilha",
    "steps": "1. Corte o pão em fatias grossas.\n2. Misture leite com baunilha e mergulhe as fatias.\n3. Passe nos ovos batidos.\n4. Frite em óleo quente até dourar dos dois lados.\n5. Escorra e polvilhe com açúcar e canela.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 22,
    "title": "Ovos de Páscoa de chocolate caseiros",
    "category": "Sobremesas",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Páscoa",
    "image": "https://images.pexels.com/photos/3218467/pexels-photo-3218467.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Ovos de Páscoa de chocolate",
    "time": "2h",
    "difficulty": "Média",
    "shortDescription": "Ovos de chocolate ao leite recheados com brigadeiro cremoso.",
    "ingredients": "• 500g de chocolate ao leite\n• 1 lata de leite condensado\n• 1 colher de manteiga\n• 2 colheres de chocolate em pó\n• Forma de ovo de Páscoa",
    "steps": "1. Derreta o chocolate em banho-maria.\n2. Pincele as formas e leve à geladeira.\n3. Repita duas vezes para firmar a casca.\n4. Prepare o brigadeiro com os demais ingredientes.\n5. Recheie os ovos com brigadeiro, junte as metades e sirva.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 23,
    "title": "Arroz carreteiro gaúcho",
    "category": "Arroz",
    "country": "Brasil",
    "region": "Sul",
    "occasion": "Domingo",
    "image": "https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Arroz carreteiro gaúcho",
    "time": "45 min",
    "difficulty": "Baixa",
    "shortDescription": "Arroz soltinho com charque e linguiça, prato clássico do sul do Brasil.",
    "ingredients": "• 2 xícaras de arroz\n• 300g de charque dessalgado\n• 200g de linguiça calabresa\n• 1 cebola picada\n• 3 dentes de alho\n• Cheiro-verde\n• Azeite",
    "steps": "1. Dessalgue o charque em água fria por 2 horas.\n2. Frite a linguiça e o charque até dourar.\n3. Refogue cebola e alho no mesmo gordura.\n4. Adicione o arroz e refogue.\n5. Acrescente água e cozinhe até secar. Finalize com cheiro-verde.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 24,
    "title": "Bolo de aniversário clássico",
    "category": "Pão e bolos",
    "country": "Brasil",
    "region": "Sudeste",
    "occasion": "Aniversários",
    "image": "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Bolo de aniversário clássico",
    "time": "2h",
    "difficulty": "Média",
    "shortDescription": "Bolo fofo de baunilha com cobertura de chantilly e frutas vermelhas.",
    "ingredients": "• 4 ovos\n• 2 xícaras de açúcar\n• 2 xícaras de farinha\n• 1 xícara de leite morno\n• 1 xícara de óleo\n• 1 colher de fermento\n• Chantilly e frutas vermelhas para decorar",
    "steps": "1. Bata ovos e açúcar até dobrar de volume.\n2. Adicione leite e óleo aos poucos.\n3. Incorpore a farinha e o fermento delicadamente.\n4. Asse em forma untada a 180°C por 35 minutos.\n5. Cubra com chantilly e decore com as frutas.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  },
  {
    "id": 25,
    "title": "Paella valenciana",
    "category": "Arroz",
    "country": "Espanha",
    "region": "",
    "occasion": "Domingo",
    "image": "https://images.pexels.com/photos/12419210/pexels-photo-12419210.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Paella valenciana",
    "time": "1h",
    "difficulty": "Alta",
    "shortDescription": "Arroz espanhol com frutos do mar, açafrão e pimentão, cozido em paellera.",
    "ingredients": "• 400g de arroz arbóreo\n• 300g de camarão\n• 300g de mariscos\n• 1 pitada de açafrão\n• Pimentão vermelho e verde\n• Tomate, alho e cebola\n• Caldo de peixe\n• Azeite de oliva",
    "steps": "1. Refogue alho, cebola e pimentão no azeite.\n2. Adicione o tomate e deixe apurar.\n3. Acrescente o arroz e o açafrão diluído no caldo.\n4. Adicione os frutos do mar e o caldo restante.\n5. Cozinhe sem mexer até o arroz absorver tudo. Sirva na própria paellera.",
    "createdBy": "admin", "authorUsername": "admin", "authorName": "Wagner Chef", "authorRole": "chef"
  },
  {
    "id": 26,
    "title": "Pho de frango vietnamita",
    "category": "Sopas",
    "country": "Vietnã",
    "region": "",
    "occasion": "Jantar",
    "image": "https://images.pexels.com/photos/3028500/pexels-photo-3028500.jpeg?auto=compress&cs=tinysrgb&w=1280",
    "alt": "Pho de frango vietnamita",
    "time": "2h",
    "difficulty": "Média",
    "shortDescription": "Sopa aromática vietnamita com macarrão de arroz, frango e ervas frescas.",
    "ingredients": "• 1 carcaça de frango\n• 200g de macarrão de arroz\n• Anís estrelado, canela, cravo\n• Gengibre tostado\n• Molho de peixe (nam pla)\n• Broto de feijão\n• Hortelã, manjericão e cebolinha\n• Limão",
    "steps": "1. Toste o gengibre e as especiarias.\n2. Ferva a carcaça com as especiarias por 1h30.\n3. Coe o caldo e tempere com molho de peixe.\n4. Cozinhe o macarrão separado.\n5. Monte a tigela com macarrão, frango desfiado e caldo. Finalize com ervas frescas e limão.",
    "createdBy": "usuario", "authorUsername": "usuario", "authorName": "Ana Turista", "authorRole": "turista"
  }
];

function loadRecipesFromJson() {
  return fetch(RECIPES_JSON_PATH)
    .then(r => r.json())
    .then(json => {
      const base = Array.isArray(json) ? json : FALLBACK_RECIPES;
      const stored = getStoredRecipes();
      recipes = base.concat(stored.map((r, i) => ({ ...r, id: r.id || `user-${Date.now()}-${i}` })));
    })
    .catch(() => {
      const stored = getStoredRecipes();
      recipes = FALLBACK_RECIPES.concat(stored.map((r, i) => ({ ...r, id: r.id || `user-${Date.now()}-${i}` })));
    });
}

// --- Recipe wizard ---

function resetRecipeWizard() {
  wizardType = null;
  const ids = ['wizard-country', 'wizard-region', 'wizard-occasion'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const breadcrumb = document.getElementById('wizard-breadcrumb');
  const step1 = document.getElementById('wizard-step-1');
  const stepBrasil = document.getElementById('wizard-step-brasil');
  const stepMundo = document.getElementById('wizard-step-mundo');
  const stepCom = document.getElementById('wizard-step-comemorativo');
  const formFields = document.getElementById('recipe-form-fields');
  const wizardError = document.getElementById('wizard-error');
  if (breadcrumb) breadcrumb.classList.add('hidden');
  if (step1) step1.classList.remove('hidden');
  if (stepBrasil) stepBrasil.classList.add('hidden');
  if (stepMundo) stepMundo.classList.add('hidden');
  if (stepCom) stepCom.classList.add('hidden');
  if (formFields) formFields.classList.add('hidden');
  if (wizardError) wizardError.textContent = '';
  const mealTypeWrapper = document.getElementById('meal-type-wrapper');
  if (mealTypeWrapper) mealTypeWrapper.style.display = '';
}

function setupRecipeWizard() {
  if (!recipeSubmitForm) return;

  const step1 = document.getElementById('wizard-step-1');
  const stepBrasil = document.getElementById('wizard-step-brasil');
  const stepMundo = document.getElementById('wizard-step-mundo');
  const stepCom = document.getElementById('wizard-step-comemorativo');
  const breadcrumb = document.getElementById('wizard-breadcrumb');
  const breadcrumbText = document.getElementById('wizard-breadcrumb-text');
  const formFields = document.getElementById('recipe-form-fields');
  const wizardCountryEl = document.getElementById('wizard-country');
  const wizardRegionEl = document.getElementById('wizard-region');
  const wizardOccasionEl = document.getElementById('wizard-occasion');
  const mealTypeWrapper = document.getElementById('meal-type-wrapper');

  function completeWizard(text) {
    if (breadcrumb) breadcrumb.classList.remove('hidden');
    if (breadcrumbText) breadcrumbText.textContent = text;
    if (step1) step1.classList.add('hidden');
    if (stepBrasil) stepBrasil.classList.add('hidden');
    if (stepMundo) stepMundo.classList.add('hidden');
    if (stepCom) stepCom.classList.add('hidden');
    if (formFields) formFields.classList.remove('hidden');
    const err = document.getElementById('wizard-error');
    if (err) err.textContent = '';
    // For comemorativo: hide meal type picker, occasion already captured
    if (mealTypeWrapper) mealTypeWrapper.style.display = wizardType === 'comemorativo' ? 'none' : '';
  }

  // Step 1 main cards
  document.querySelectorAll('[data-wizard]').forEach(btn => {
    btn.addEventListener('click', () => {
      wizardType = btn.dataset.wizard;
      if (step1) step1.classList.add('hidden');
      if (wizardType === 'brasil' && stepBrasil) stepBrasil.classList.remove('hidden');
      else if (wizardType === 'mundo' && stepMundo) stepMundo.classList.remove('hidden');
      else if (wizardType === 'comemorativo' && stepCom) stepCom.classList.remove('hidden');
    });
  });

  // Brasil regions
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (wizardCountryEl) wizardCountryEl.value = 'Brasil';
      if (wizardRegionEl) wizardRegionEl.value = btn.dataset.region;
      if (wizardOccasionEl) wizardOccasionEl.value = '';
      completeWizard(`🇧🇷 Brasil · ${btn.dataset.region}`);
    });
  });

  // World country buttons
  document.querySelectorAll('[data-country]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (wizardCountryEl) wizardCountryEl.value = btn.dataset.country;
      if (wizardRegionEl) wizardRegionEl.value = '';
      if (wizardOccasionEl) wizardOccasionEl.value = '';
      completeWizard(`🌍 ${btn.dataset.country}`);
    });
  });

  // Custom country input
  const countryInput = document.getElementById('wizard-country-input');
  const countryConfirm = document.getElementById('wizard-country-confirm');
  countryConfirm?.addEventListener('click', () => {
    const val = countryInput?.value.trim();
    if (!val) return;
    if (wizardCountryEl) wizardCountryEl.value = val;
    if (wizardRegionEl) wizardRegionEl.value = '';
    if (wizardOccasionEl) wizardOccasionEl.value = '';
    if (countryInput) countryInput.value = '';
    completeWizard(`🌍 ${val}`);
  });
  countryInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); countryConfirm?.click(); }
  });

  // Commemorative occasions
  document.querySelectorAll('[data-occasion]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (wizardCountryEl) wizardCountryEl.value = 'Brasil';
      if (wizardRegionEl) wizardRegionEl.value = '';
      if (wizardOccasionEl) wizardOccasionEl.value = btn.dataset.occasion;
      completeWizard(`🎉 ${btn.dataset.occasion}`);
    });
  });

  // Botões "← Voltar" nos passos 2a/2b/2c — retornam ao passo 1 sem apagar os campos já digitados
  document.querySelectorAll('.wizard-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wizardType = null;
      if (step1) step1.classList.remove('hidden');
      if (stepBrasil) stepBrasil.classList.add('hidden');
      if (stepMundo) stepMundo.classList.add('hidden');
      if (stepCom) stepCom.classList.add('hidden');
    });
  });

  // Reset button
  document.getElementById('wizard-reset')?.addEventListener('click', resetRecipeWizard);
}

// --- Auth tabs ---

function setupAuthTabs() {
  const loginTab = document.querySelector('#tab-login');
  const registerTab = document.querySelector('#tab-register');
  const loginPanel = document.querySelector('#login-panel');
  const registerPanel = document.querySelector('#register-panel');
  if (!loginTab || !registerTab) return;

  loginTab.addEventListener('click', () => {
    loginTab.classList.add('tab-active');
    registerTab.classList.remove('tab-active');
    loginPanel?.classList.remove('hidden');
    registerPanel?.classList.add('hidden');
    if (loginError) loginError.textContent = '';
  });
  registerTab.addEventListener('click', () => {
    registerTab.classList.add('tab-active');
    loginTab.classList.remove('tab-active');
    registerPanel?.classList.remove('hidden');
    loginPanel?.classList.add('hidden');
    if (registerError) registerError.textContent = '';
  });
}

// --- Community tabs ---

function setupCommunityTabs() {
  const chefTab = document.querySelector('#community-tab-chef');
  const turistaTab = document.querySelector('#community-tab-turista');
  const chefsGrid = document.querySelector('#community-chefs');
  const turistasGrid = document.querySelector('#community-turistas');
  if (!chefTab || !turistaTab) return;

  chefTab.addEventListener('click', () => {
    chefTab.classList.add('tab-active');
    turistaTab.classList.remove('tab-active');
    chefsGrid?.classList.remove('hidden');
    turistasGrid?.classList.add('hidden');
  });
  turistaTab.addEventListener('click', () => {
    turistaTab.classList.add('tab-active');
    chefTab.classList.remove('tab-active');
    turistasGrid?.classList.remove('hidden');
    chefsGrid?.classList.add('hidden');
  });
}

// --- Mobile menu ---

function setupMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => menu.classList.add('hidden'));
}

// --- Modal like ---

function setupModalLikeBtn() {
  const likeBtn = document.querySelector('#modal-like-btn');
  if (!likeBtn) return;
  likeBtn.addEventListener('click', () => {
    if (!currentModalRecipeId || !loggedUser) return;
    toggleLike(currentModalRecipeId);
    updateModalInteractions(currentModalRecipeId);
    renderRecipeCards();
  });
}

// --- Init ---

document.addEventListener('DOMContentLoaded', async function () {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  loggedUser = getLoggedUser();

  // Página de login: redireciona se já logado, configura formulários e encerra
  if (bodyPage === 'login') {
    if (loggedUser) {
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('redirect') || 'receitas.html';
      return;
    }
    loginForm?.addEventListener('submit', handleLogin);
    registerForm?.addEventListener('submit', handleRegister);
    setupMobileMenu();
    setupAuthTabs();
    return;
  }

  await loadRecipesFromJson();

  updateUserPanel();
  renderRecipeCards();
  renderPrestigeRanking();
  renderCommunitySection();

  if (bodyPage === 'receitas') {
    searchButton?.addEventListener('click', () => filterCards(true));
    searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); filterCards(true); } });
    searchInput?.addEventListener('input', () => filterCards(false));

    document.getElementById('btn-cadastrar-receita')?.addEventListener('click', () => {
      const form = document.getElementById('recipe-form');
      if (form) {
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) {
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  filterTags.forEach(tag => {
    if (tag.dataset.group) tag.addEventListener('click', () => handleFilterTagClick(tag));
  });

  document.querySelector('#clear-filters')?.addEventListener('click', () => {
    activeFilters.country = null;
    activeFilters.region = null;
    activeFilters.occasion = null;
    updateFilterButtons();
    filterCards();
  });

  recipeSubmitForm?.addEventListener('submit', handleRecipeSubmit);
  logoutButton?.addEventListener('click', handleLogout);

  document.querySelector('#recipe-detail-close')?.addEventListener('click', hideRecipe);
  document.querySelector('#recipe-detail-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) hideRecipe();
  });

  setupMobileMenu();
  setupCommunityTabs();
  setupModalLikeBtn();
  setupRecipeWizard();
});
