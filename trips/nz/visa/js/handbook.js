(() => {
  const data = window.HANDBOOK;
  if (!data) return;

  const KEY = "nz-visa-handbook-checks-v3";
  let checks = {};
  try {
    checks = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {}

  const save = () => localStorage.setItem(KEY, JSON.stringify(checks));

  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const phaseComplete = (phase) => phase.items.every((item) => checks[item.id]);

  // 状态只跟勾选进度走；日期仅作参考，不参与判定
  const computeStatus = (phase) => {
    if (phaseComplete(phase)) return "done";
    const firstIncomplete = data.timeline.find((p) => !phaseComplete(p));
    if (firstIncomplete && firstIncomplete.id === phase.id) return "now";
    return "later";
  };

  const statusLabel = {
    now: "进行中",
    done: "已完成",
    later: "",
  };

  const timelineTasks = data.timeline.flatMap((g) =>
    g.items.map((item) => ({
      id: item.id,
      text: item.text,
      groupId: g.id,
    }))
  );

  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "className") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) {
      if (c == null) continue;
      n.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  };

  const tplHref = (file) => encodeURI(`templates/${file}`);

  const resolveTemplates = (ids = []) =>
    (ids || [])
      .map((id) => data.templateIndex[id])
      .filter(Boolean)
      .map((t) => ({
        label: t.label,
        href: tplHref(t.file),
        file: t.file,
      }));

  const templateLinks = (ids) => {
    const list = resolveTemplates(ids);
    if (!list.length) return null;
    const nodes = [el("span", { className: "extra-label", text: "模板：" })];
    list.forEach((t, i) => {
      if (i) nodes.push(" ");
      nodes.push(
        el("a", {
          className: "tpl-chip",
          href: t.href,
          target: "_blank",
          rel: "noopener",
          text: `${t.label} · 打开`,
          onClick: (e) => e.stopPropagation(),
        })
      );
      nodes.push(" ");
      nodes.push(
        el("a", {
          className: "tpl-chip tpl-chip--dl",
          href: t.href,
          download: t.file,
          text: "下载",
          onClick: (e) => e.stopPropagation(),
        })
      );
    });
    return el("div", { className: "extra" }, nodes);
  };

  const extLink = (link) => {
    if (!link) return null;
    return el("div", { className: "extra" }, [
      el("a", {
        href: link.href,
        target: "_blank",
        rel: "noopener",
        text: link.label,
        onClick: (e) => e.stopPropagation(),
      }),
    ]);
  };

  const nextLink = document.querySelector("[data-next] a");
  const nextText = document.querySelector("[data-next-text]");

  const updateCurrent = () => {
    const next = timelineTasks.find((t) => !checks[t.id]);
    if (!next) {
      nextText.textContent = "排期事项已全部完成";
      nextLink.removeAttribute("href");
      return;
    }
    nextText.textContent = next.text;
    nextLink.href = `#phase-${next.groupId}`;
  };

  const checkItem = (id, labelKids, extras = []) => {
    const input = el("input", {
      type: "checkbox",
      className: "check",
      id,
      checked: !!checks[id],
      onChange: (e) => {
        checks[id] = e.target.checked;
        save();
        updateCurrent();
        refreshPhaseBadges();
      },
    });
    const label = el("label", { for: id }, Array.isArray(labelKids) ? labelKids : [labelKids]);
    const body = el("div", { className: "item-body" }, [label, ...extras.filter(Boolean)]);
    return [input, body];
  };

  document.querySelector("[data-subtitle]").textContent = data.meta.subtitle;
  document.querySelector("[data-asof]").textContent = `排期基准日 ${data.meta.asOf}`;
  document.querySelector("[data-reviewed]").textContent = `材料核对日 ${data.meta.lastReviewed}`;
  document.querySelector("[data-today]").textContent = today;

  const phaseStatuses = {};
  data.timeline.forEach((g) => {
    phaseStatuses[g.id] = computeStatus(g);
  });

  const findFocusPhaseId = () =>
    data.timeline.find((g) => phaseStatuses[g.id] === "now")?.id ||
    data.timeline[data.timeline.length - 1].id;

  // 侧栏导航
  const sidenav = document.querySelector("[data-sidenav]");
  sidenav.append(el("div", { className: "sidenav__title", text: "导航" }));

  const navPhase = el("div", { className: "sidenav__group" }, [el("div", { className: "sidenav__label", text: "办理排期" })]);
  data.timeline.forEach((g) => {
    const st = phaseStatuses[g.id];
    navPhase.append(
      el("a", {
        className: `sidenav__link is-${st}`,
        href: `#phase-${g.id}`,
        "data-nav-phase": g.id,
        text: g.title,
      })
    );
  });
  sidenav.append(navPhase);

  const navMore = el("div", { className: "sidenav__group" }, [el("div", { className: "sidenav__label", text: "其他" })]);
  [
    ["sec-batches", "外勤合并建议"],
    ["sec-templates", "模板文件"],
    ["sec-docs", "材料一览"],
    ["sec-funds", "资金要求"],
    ["sec-paths", "申请路径"],
    ["sec-preflight", "递交前核对"],
    ["sec-links", "官方链接"],
  ].forEach(([id, label]) => {
    navMore.append(el("a", { className: "sidenav__link", href: `#${id}`, text: label }));
  });
  sidenav.append(navMore);

  const timelineRoot = document.querySelector("[data-timeline]");
  const badgeEls = {};

  data.timeline.forEach((g) => {
    const st = phaseStatuses[g.id];
    const badge = el("span", { className: "phase__badge", text: statusLabel[st] || "" });
    badgeEls[g.id] = badge;

    const items = g.items.map((item) =>
      el(
        "li",
        {},
        checkItem(item.id, [item.text], [extLink(item.link), templateLinks(item.templates)])
      )
    );

    timelineRoot.append(
      el("section", { className: `phase group ${st}`, id: `phase-${g.id}`, "data-phase-id": g.id }, [
        el("div", { className: "phase__meta" }, [
          el("span", { className: "phase__when", text: `参考时间 · ${g.when}` }),
          badge,
        ]),
        el("h3", { className: "phase__title", text: g.title }),
        el("ul", { className: "phase__items" }, items),
      ])
    );
  });

  const setActiveNav = (href) => {
    sidenav.querySelectorAll(".sidenav__link").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("href") === href);
    });
  };

  const refreshPhaseBadges = () => {
    data.timeline.forEach((g) => {
      const st = computeStatus(g);
      phaseStatuses[g.id] = st;
      const section = document.querySelector(`[data-phase-id="${g.id}"]`);
      if (section) {
        section.className = `phase group ${st}`;
      }
      if (badgeEls[g.id]) badgeEls[g.id].textContent = statusLabel[st] || "";
      const navLink = document.querySelector(`[data-nav-phase="${g.id}"]`);
      if (navLink) {
        const keepActive = navLink.classList.contains("is-active");
        navLink.className = `sidenav__link is-${st}${keepActive ? " is-active" : ""}`;
      }
    });
  };

  updateCurrent();

  const focusId = findFocusPhaseId();
  const focusEl = document.getElementById(`phase-${focusId}`);
  setActiveNav(`#phase-${focusId}`);

  requestAnimationFrame(() => {
    if (!focusEl) return;
    focusEl.scrollIntoView({ block: "start", behavior: "auto" });
  });

  // 点击立刻高亮；滚动时按可视区块更新
  sidenav.addEventListener("click", (e) => {
    const a = e.target.closest("a.sidenav__link");
    if (!a) return;
    setActiveNav(a.getAttribute("href"));
  });

  const sectionIds = [
    ...data.timeline.map((g) => `phase-${g.id}`),
    "sec-batches",
    "sec-templates",
    "sec-docs",
    "sec-funds",
    "sec-paths",
    "sec-preflight",
    "sec-links",
  ];

  let scrollLock = false;
  sidenav.addEventListener("click", () => {
    scrollLock = true;
    window.setTimeout(() => {
      scrollLock = false;
    }, 500);
  });

  const syncNavFromScroll = () => {
    if (scrollLock) return;
    const marker = window.innerWidth <= 860 ? 72 : 96;
    let current = sectionIds[0];
    for (const id of sectionIds) {
      const node = document.getElementById(id);
      if (!node) continue;
      if (node.getBoundingClientRect().top <= marker) current = id;
    }
    setActiveNav(`#${current}`);
  };

  window.addEventListener("scroll", syncNavFromScroll, { passive: true });
  window.addEventListener("resize", syncNavFromScroll);

  const batchesRoot = document.querySelector("[data-batches]");
  data.batches.forEach((b) => {
    const block = el("section", { className: "errand", id: `batch-${b.id}` }, [
      el("h3", { className: "errand__place", text: b.title }),
      b.note ? el("p", { className: "errand__blurb", text: b.note }) : null,
    ]);

    if (b.carry && b.carry.length) {
      block.append(
        el("div", { className: "errand__bring" }, [
          el("strong", { text: "建议携带：" }),
          el(
            "ul",
            {},
            b.carry.map((x) => el("li", { text: x }))
          ),
        ])
      );
    }

    block.append(
      el("div", { className: "errand__bring" }, [
        el("strong", { text: "一次办结：" }),
        el(
          "ul",
          {},
          b.tasks.map((x) => el("li", { text: x }))
        ),
      ])
    );

    if (b.link) {
      block.append(
        el("div", { className: "errand__links" }, [
          el("a", { href: b.link.href, target: "_blank", rel: "noopener", text: b.link.label }),
        ])
      );
    }

    if (b.templates) block.append(templateLinks(b.templates));
    batchesRoot.append(block);
  });

  const tplRoot = document.querySelector("[data-templates]");
  Object.values(data.templateIndex).forEach((t) => {
    const href = tplHref(t.file);
    tplRoot.append(
      el("li", {}, [
        el("span", { className: "tpl-name", text: t.label }),
        el("a", { href, target: "_blank", rel: "noopener", text: "打开" }),
        el("a", { href, download: t.file, text: "下载" }),
      ])
    );
  });

  const docsRoot = document.querySelector("[data-docs]");
  data.docs.forEach((d) => {
    const title = [d.title];
    if (d.optional) title.push(el("span", { className: "optional", text: "（如适用）" }));
    docsRoot.append(
      el("li", {}, [
        el("div", { className: "doc-main" }, [
          el("strong", {}, title),
          el("span", { className: "detail", text: d.detail }),
          el("span", { className: "upload", text: `上传位置：${d.upload} · 办理渠道：${d.channel}` }),
          templateLinks(d.templates),
        ]),
      ])
    );
  });

  const funds = document.querySelector("[data-funds]");
  data.funds.forEach((t) => funds.append(el("li", { text: t })));

  const paths = document.querySelector("[data-paths]");
  data.paths.forEach((p) => {
    paths.append(
      el("div", { className: `path${p.recommended ? " recommended" : ""}` }, [
        el("h3", { text: p.title }),
        el("p", { className: "fee", text: p.fee }),
        el("p", { className: "req", text: `${p.perPerson}；${p.requires}` }),
        el(
          "ol",
          {},
          p.steps.map((s) => el("li", { text: s }))
        ),
        templateLinks(p.templates),
        el("p", {}, [el("a", { href: p.link, target: "_blank", rel: "noopener", text: p.visaType })]),
      ])
    );
  });

  const pre = document.querySelector("[data-preflight]");
  data.preflight.forEach((r) => pre.append(el("li", {}, checkItem(r.id, r.text))));

  const links = document.querySelector("[data-links]");
  data.links.forEach((l) => {
    links.append(el("li", {}, [el("a", { href: l.href, target: "_blank", rel: "noopener", text: l.label })]));
  });
})();
