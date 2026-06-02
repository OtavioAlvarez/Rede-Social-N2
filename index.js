const POSTS_URL = "https://jsonplaceholder.typicode.com/posts";
const USERS_URL = "https://jsonplaceholder.typicode.com/users";
const STORAGE_KEY = "emo-posts";
const POSTS_PER_PAGE = 10;
const CURRENT_USER_ID = 1;

const page = document.body.dataset.page;
let visiblePosts = POSTS_PER_PAGE;
let cachedPosts = [];
let cachedUsers = [];

function getInitials(name) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
}

function criarPostCard(post, user, editable = false) {
    const authorName = user?.name || "Usuario desconhecido";
    const username = user?.username || "semusuario";
    const company = user?.company?.name || "Rede EMO";
    const initials = getInitials(authorName);
    const canEdit = editable || post.userId === CURRENT_USER_ID;

    return `
        <article class="card post-card" data-post-id="${post.id}">
            <header class="post-header">
                <div class="post-author">
                    <span class="mini-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
                    <div>
                        <h4>${escapeHtml(authorName)}</h4>
                        <p>@${escapeHtml(username)} <span aria-hidden="true">&middot;</span> ${escapeHtml(company)}</p>
                    </div>
                </div>

                <div class="post-actions" aria-label="Acoes do post">
                    ${canEdit
                        ? '<button type="button" data-action="edit-post">Editar</button><button class="is-danger" type="button" data-action="delete-post">Excluir</button>'
                        : '<button type="button">Salvar</button><button type="button">Ver perfil</button>'}
                </div>
            </header>

            <div class="post-body">
                <h5>${escapeHtml(post.title)}</h5>
                <p>${escapeHtml(post.body)}</p>
            </div>

            <footer class="post-footer">
                <div class="engagement">
                    <span>Curtir</span>
                    <span>Comentar</span>
                </div>
                <a href="#">Compartilhar</a>
            </footer>
        </article>
    `;
}

async function getJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Erro ao carregar ${url}`);
    }

    return response.json();
}

async function sendJson(url, method, body) {
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Erro ao ${method} ${url}`);
    }

    return response.json();
}

function savePosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function loadSavedPosts() {
    const savedPosts = localStorage.getItem(STORAGE_KEY);

    return savedPosts ? JSON.parse(savedPosts) : null;
}

function sortPosts(posts) {
    return [...posts].sort((firstPost, secondPost) => secondPost.id - firstPost.id);
}

function renderContacts(users) {
    const contactList = document.querySelector(".contact-list");

    if (!contactList) {
        return;
    }

    contactList.innerHTML = users.slice(0, 5).map((user) => `
        <li>
            <a class="contact-card" href="#">
                <span class="contact-avatar" aria-hidden="true">${escapeHtml(getInitials(user.name))}</span>
                <span class="contact-copy">
                    <strong>${escapeHtml(user.name)}</strong>
                    <small>@${escapeHtml(user.username)} <span aria-hidden="true">&middot;</span> ${escapeHtml(user.address.city)}</small>
                </span>
            </a>
        </li>
    `).join("");
}

function renderNetworkFeed() {
    const feedList = document.querySelector('[data-js="feed-list"]');
    const loadMoreButton = document.querySelector(".load-more-wrap .secondary-button");

    if (!feedList) {
        return;
    }

    const usersById = new Map(cachedUsers.map((user) => [user.id, user]));
    const postsToRender = sortPosts(cachedPosts).slice(0, visiblePosts);

    feedList.innerHTML = postsToRender
        .map((post) => criarPostCard(post, usersById.get(post.userId)))
        .join("");

    if (loadMoreButton) {
        loadMoreButton.hidden = visiblePosts >= cachedPosts.length;
    }
}

function setupLoadMoreButton() {
    const loadMoreButton = document.querySelector(".load-more-wrap .secondary-button");

    if (!loadMoreButton) {
        return;
    }

    loadMoreButton.addEventListener("click", () => {
        visiblePosts += POSTS_PER_PAGE;
        renderNetworkFeed();
    });
}

function setupComposer() {
    const composerForm = document.querySelector(".composer-form");
    const textarea = composerForm?.querySelector("textarea");

    if (!composerForm || !textarea) {
        return;
    }

    composerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const body = textarea.value.trim();

        if (!body) {
            return;
        }

        const newPost = {
            id: Date.now(),
            userId: CURRENT_USER_ID,
            title: body.slice(0, 48),
            body,
        };

        cachedPosts = [newPost, ...cachedPosts];
        savePosts(cachedPosts);
        textarea.value = "";
        renderNetworkFeed();

        try {
            await sendJson(POSTS_URL, "POST", newPost);
        } catch (error) {
            console.warn("Post salvo localmente, mas a API nao confirmou.", error);
        }
    });
}

function setupPostActions(containerSelector, renderCallback) {
    const container = document.querySelector(containerSelector);

    if (!container) {
        return;
    }

    container.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const postCard = button.closest("[data-post-id]");
        const postId = Number(postCard?.dataset.postId);
        const post = cachedPosts.find((item) => item.id === postId);

        if (!post) {
            return;
        }

        if (button.dataset.action === "edit-post") {
            const newTitle = prompt("Novo titulo do post:", post.title);
            const newBody = prompt("Novo texto do post:", post.body);

            if (!newTitle || !newBody) {
                return;
            }

            Object.assign(post, {
                title: newTitle.trim(),
                body: newBody.trim(),
            });

            savePosts(cachedPosts);
            renderCallback();

            try {
                await sendJson(`${POSTS_URL}/${post.id}`, "PUT", post);
            } catch (error) {
                console.warn("Post alterado localmente, mas a API nao confirmou.", error);
            }
        }

        if (button.dataset.action === "delete-post") {
            const shouldDelete = confirm("Deseja excluir este post?");

            if (!shouldDelete) {
                return;
            }

            cachedPosts = cachedPosts.filter((item) => item.id !== postId);
            savePosts(cachedPosts);
            renderCallback();

            try {
                await sendJson(`${POSTS_URL}/${post.id}`, "DELETE", {});
            } catch (error) {
                console.warn("Post excluido localmente, mas a API nao confirmou.", error);
            }
        }
    });
}

function renderProfile(user, posts) {
    const profileName = document.querySelector("#profile-name");
    const profileDescription = document.querySelector(".profile-copy p");
    const profileAvatar = document.querySelector(".profile-avatar");
    const topbarAvatar = document.querySelector(".topbar-avatar");
    const aboutItems = document.querySelectorAll(".info-list dd");
    const postsColumn = document.querySelector(".posts-column");

    if (!profileName || !profileDescription || !profileAvatar || !postsColumn) {
        return;
    }

    const initials = getInitials(user.name);

    profileName.textContent = user.name;
    profileDescription.innerHTML = `@${escapeHtml(user.username)} <span aria-hidden="true">&middot;</span> ${escapeHtml(user.company.name)}`;
    profileAvatar.textContent = initials;

    if (topbarAvatar) {
        topbarAvatar.textContent = initials;
    }

    if (aboutItems.length >= 5) {
        aboutItems[0].textContent = user.email;
        aboutItems[1].textContent = user.phone;
        aboutItems[2].innerHTML = `<a href="https://${escapeHtml(user.website)}">${escapeHtml(user.website)}</a>`;
        aboutItems[3].textContent = user.address.city;
        aboutItems[4].textContent = user.company.name;
    }

    postsColumn.innerHTML = `
        <h3 id="recent-posts-title" class="section-title">Posts recentes</h3>
        ${sortPosts(posts).map((post) => criarPostCard(post, user, true)).join("")}
    `;
}

function renderError(targetSelector) {
    const target = document.querySelector(targetSelector);

    if (target) {
        target.innerHTML = `
            <article class="card post-card">
                <div class="post-body">
                    <h5>Nao foi possivel carregar os dados</h5>
                    <p>Confira sua conexao e tente novamente em alguns instantes.</p>
                </div>
            </article>
        `;
    }
}

async function loadNetworkFeed() {
    const feedList = document.querySelector('[data-js="feed-list"]');

    if (!feedList) {
        return;
    }

    feedList.innerHTML = '<p class="loading-message">Carregando atualizacoes...</p>';

    try {
        const savedPosts = loadSavedPosts();
        const [posts, users] = await Promise.all([
            getJson(POSTS_URL),
            getJson(USERS_URL),
        ]);

        cachedPosts = savedPosts || posts;
        cachedUsers = users;
        renderContacts(cachedUsers);
        renderNetworkFeed();
        setupLoadMoreButton();
        setupComposer();
        setupPostActions('[data-js="feed-list"]', renderNetworkFeed);
    } catch (error) {
        renderError('[data-js="feed-list"]');
    }
}

async function carregarPerfil() {
    try {
        const savedPosts = loadSavedPosts();
        const [user, posts, users] = await Promise.all([
            getJson(`${USERS_URL}/1`),
            getJson(POSTS_URL),
            getJson(USERS_URL),
        ]);

        cachedUsers = users;
        cachedPosts = savedPosts || posts;
        renderProfile(user, cachedPosts.filter((post) => post.userId === CURRENT_USER_ID).slice(0, 5));
        setupPostActions(".posts-column", () => {
            renderProfile(user, cachedPosts.filter((post) => post.userId === CURRENT_USER_ID).slice(0, 5));
        });
    } catch (error) {
        renderError(".posts-column");
    }
}

if (page === "network") {
    loadNetworkFeed();
}

if (page === "profile") {
    carregarPerfil();
}
