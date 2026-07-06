const SHEET_TABS = ["결과", "쇼츠", "롱폼", "추천 아이디어"];
const CACHE_SECONDS = 30;
const fmt = new Intl.NumberFormat("ko-KR");
const state = { ideas: [] };

function sheetId() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("sheet") || params.get("sheetId") || "").trim();
}

function cacheKey(id) {
  return `youtube-dashboard:${id}`;
}

function text(value, fallback = "-") {
  return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value).trim();
}

function number(value) {
  const parsed = Number(String(value || "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeYoutubeUrl(url) {
  const value = String(url || "").trim();
  if (value.startsWith("https://www.youtube.com/") || value.startsWith("https://youtu.be/")) return value;
  return "";
}

function link(url, label, className = "") {
  const safeUrl = safeYoutubeUrl(url);
  const safeLabel = escapeHtml(text(label));
  if (!safeUrl) return `<span class="${className}">${safeLabel}</span>`;
  return `<a class="${className}" href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readSheetTab(id, tab) {
  return new Promise((resolve, reject) => {
    const callbackName = `__sheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const params = new URLSearchParams({
      tqx: `responseHandler:${callbackName}`,
      sheet: tab,
    });
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`${tab} 탭 응답이 지연되었습니다.`));
    }, 10000);

    function cleanup() {
      window.clearTimeout(timer);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (response) => {
      cleanup();
      if (response?.status === "error") {
        reject(new Error(response.errors?.[0]?.detailed_message || `${tab} 탭을 읽지 못했습니다.`));
        return;
      }
      resolve(tableToRows(response.table));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`${tab} 탭 연결에 실패했습니다.`));
    };
    script.src = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?${params.toString()}`;
    document.head.appendChild(script);
  });
}

function tableToRows(table) {
  const headers = (table?.cols || []).map((col, index) => text(col.label, `column_${index + 1}`));
  return (table?.rows || [])
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        const cell = row.c?.[index];
        record[header] = cell?.f ?? cell?.v ?? "";
      });
      return record;
    })
    .filter((row) => Object.values(row).some((value) => text(value, "") !== ""));
}

async function loadData(id) {
  const cached = readCache(id);
  if (cached) return { ...cached, fromCache: true };

  const [results, shorts, longform, ideas] = await Promise.all(SHEET_TABS.map((tab) => readSheetTab(id, tab)));
  const data = {
    loadedAt: nowText(),
    summary: summarize(results, shorts, longform, ideas),
    videos: normalizeVideos(results),
    shorts: normalizeVideos(shorts),
    longform: normalizeVideos(longform),
    ideas: normalizeIdeas(ideas),
  };
  writeCache(id, data);
  return data;
}

function readCache(id) {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.savedAt > CACHE_SECONDS * 1000) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(id, data) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // The dashboard still works when browser storage is unavailable.
  }
}

function normalizeVideos(rows) {
  return rows
    .filter((row) => text(row["제목"], "") && !text(row["제목"], "").startsWith("아직 "))
    .sort((a, b) => number(b["떡상점수"]) - number(a["떡상점수"]));
}

function normalizeIdeas(rows) {
  return rows
    .filter((row) => text(row["아이디어 제목"], "") && !text(row["아이디어 제목"], "").startsWith("아직 "))
    .sort((a, b) => (number(a["우선순위"]) || 999) - (number(b["우선순위"]) || 999));
}

function summarize(results, shorts, longform, ideas) {
  const videos = normalizeVideos(results);
  const scores = videos.map((row) => number(row["떡상점수"]));
  return {
    total: videos.length,
    shorts: normalizeVideos(shorts).length || videos.filter((row) => row["영상 유형"] === "쇼츠").length,
    longform: normalizeVideos(longform).length || videos.filter((row) => row["영상 유형"] === "롱폼").length,
    ideas: normalizeIdeas(ideas).length,
    avgScore: scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2) : "0.00",
    topScore: scores.length ? Math.max(...scores).toFixed(2) : "0.00",
    totalViews: videos.reduce((sum, row) => sum + number(row["조회수"]), 0),
  };
}

function renderSummary(summary, loadedAt, fromCache) {
  const cards = [
    ["전체 영상", fmt.format(summary.total), "공개 시트 결과 탭 기준"],
    ["쇼츠", fmt.format(summary.shorts), "쇼츠 탭 기준"],
    ["롱폼", fmt.format(summary.longform), "롱폼 탭 기준"],
    ["추천 아이디어", fmt.format(summary.ideas), "아이디어 탭 기준"],
    ["평균 점수", summary.avgScore, "전체 영상 평균"],
    ["최고 점수", summary.topScore, "상위 성과 영상"],
  ];
  document.querySelector("#summaryGrid").innerHTML = cards
    .map(([label, value, hint]) => `
      <article class="metric">
        <p class="label">${label}</p>
        <p class="value">${value}</p>
        <p class="subtext">${hint}</p>
      </article>
    `)
    .join("");

  const total = Math.max(summary.shorts + summary.longform, 1);
  document.querySelector("#shortsBar").style.width = `${(summary.shorts / total) * 100}%`;
  document.querySelector("#longformBar").style.width = `${(summary.longform / total) * 100}%`;
  document.querySelector("#shortsCount").textContent = fmt.format(summary.shorts);
  document.querySelector("#longformCount").textContent = fmt.format(summary.longform);
  document.querySelector("#status").textContent = `${loadedAt} 갱신${fromCache ? " · 30초 캐시" : ""}`;
}

function renderVideos(videos) {
  const rows = videos.slice(0, 40);
  const body = document.querySelector("#videoRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td class="empty" colspan="7">표시할 영상이 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map((row) => `
      <tr>
        <td class="score">${number(row["떡상점수"]).toFixed(1)}</td>
        <td>
          ${link(row["영상 URL"], row["제목"], "video-title")}
          <div class="subtext">${escapeHtml(text(row["영상 길이"]))} · ${escapeHtml(text(row["게시일"]))}</div>
        </td>
        <td>${link(row["채널 URL"], row["채널명"])}</td>
        <td><span class="badge">${escapeHtml(text(row["영상 유형"]))}</span></td>
        <td>${fmt.format(number(row["조회수"]))}</td>
        <td>${fmt.format(number(row["댓글수"]))}</td>
        <td>${escapeHtml(text(row["추천 포인트"] || row["참고 포인트"] || row["성과 해석"]))}</td>
      </tr>
    `)
    .join("");
}

function renderIdeas(ideas) {
  state.ideas = ideas;
  const grid = document.querySelector("#ideasGrid");
  if (!ideas.length) {
    grid.innerHTML = `<div class="empty">표시할 추천 아이디어가 없습니다.</div>`;
    return;
  }
  grid.innerHTML = ideas
    .map((idea, index) => `
      <button class="idea-card" data-index="${index}">
        <span class="priority">#${escapeHtml(text(idea["우선순위"], index + 1))}</span>
        <h3>${escapeHtml(text(idea["아이디어 제목"]))}</h3>
        <p><b>${escapeHtml(text(idea["추천 영상 유형"]))}</b> · ${escapeHtml(text(idea["콘텐츠 방향"]))}</p>
      </button>
    `)
    .join("");
  grid.querySelectorAll(".idea-card").forEach((card) => {
    card.addEventListener("click", () => openIdea(state.ideas[Number(card.dataset.index)]));
  });
}

function openIdea(idea) {
  document.querySelector("#drawerType").textContent = `${text(idea["추천 영상 유형"])} IDEA`;
  document.querySelector("#drawerTitle").textContent = text(idea["아이디어 제목"]);
  const fields = [
    "콘텐츠 방향",
    "추천 근거",
    "참고 제목 패턴",
    "참고한 제목 패턴",
    "참고 썸네일 패턴",
    "참고한 썸네일 패턴",
    "예상 시청자 관심 포인트",
    "난이도",
    "우선순위",
  ];
  document.querySelector("#drawerDetails").innerHTML = fields
    .filter((field) => text(idea[field], "") !== "")
    .map((field) => `<div><dt>${escapeHtml(field)}</dt><dd>${escapeHtml(text(idea[field]))}</dd></div>`)
    .join("");
  document.querySelector("#drawer").classList.add("open");
  document.querySelector("#scrim").classList.add("open");
}

function closeDrawer() {
  document.querySelector("#drawer").classList.remove("open");
  document.querySelector("#scrim").classList.remove("open");
}

function renderMissingSheetId() {
  document.querySelector("#status").textContent = "시트 ID 필요";
  document.querySelector(".layout").innerHTML = `
    <section class="panel">
      <h2>공개 Google Sheet ID를 URL에 붙여 주세요</h2>
      <p class="subtext">예: <code>?sheet=구글시트ID</code></p>
      <p class="subtext">서비스 계정 JSON, API 키, .env 파일은 필요하지 않습니다.</p>
    </section>
  `;
}

function renderError(error) {
  document.querySelector("#status").textContent = "데이터 읽기 실패";
  document.querySelector(".layout").innerHTML = `
    <section class="panel">
      <h2>데이터를 불러오지 못했습니다</h2>
      <p class="subtext">${escapeHtml(error.message)}</p>
      <p class="subtext">Google Sheet가 링크 보기 공개 상태인지, 탭 이름이 결과/쇼츠/롱폼/추천 아이디어인지 확인해 주세요.</p>
    </section>
  `;
}

function nowText() {
  return new Date().toLocaleString("ko-KR", { hour12: false });
}

async function boot() {
  const id = sheetId();
  if (!id) {
    renderMissingSheetId();
    return;
  }
  const data = await loadData(id);
  renderSummary(data.summary, data.loadedAt, data.fromCache);
  renderVideos(data.videos);
  renderIdeas(data.ideas);
}

document.querySelector("#closeDrawer").addEventListener("click", closeDrawer);
document.querySelector("#scrim").addEventListener("click", closeDrawer);

boot().catch(renderError);
window.setInterval(() => boot().catch(() => {}), CACHE_SECONDS * 1000);
