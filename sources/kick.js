(function () {
	var soca = false;

	function generateStreamID() {
		var text = "";
		var possible = "ABCEFGHJKLMNPQRSTUVWXYZabcefghijkmnpqrstuvwxyz23456789";
		for (var i = 0; i < 11; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	var channel = generateStreamID();
	var outputCounter = 0;
	var sendProperties = ["color", "scale", "sizeOffset", "commentBottom", "commentHeight", "authorBackgroundColor", "authorAvatarBorderColor", "authorColor", "commentBackgroundColor", "commentColor", "fontFamily", "showOnlyFirstName", "highlightWords"];
	var showOnlyFirstName = false;
	var highlightWords = [];
	var highlightWordSet = [];
	var avatarCache = {};
	var kickChannel = extractKickChannelFromUrl(window.location.href);
	var KICK_MESSAGE_SELECTOR = ".chat-message, [data-chat-entry], .chat-entry, div[data-index]";
	var KICK_CLICKABLE_CLASS = "kick-clickable";
	var KICK_HIGHLIGHT_CLASS = "kick-highlighted";
	var KICK_SHOWN_CLASS = "kick-shown";

	injectKickStyles();

	function actionwtf() {
		if (soca) {
			return;
		}

		soca = new WebSocket("wss://api.overlay.ninja");
		soca.onclose = function () {
			setTimeout(function () {
				soca = false;
				actionwtf();
			}, 2000);
		};
		soca.onopen = function () {
			soca.send(JSON.stringify({ join: channel }));
		};

		chrome.storage.sync.set({
			streamID: channel
		});

		chrome.runtime.lastError;
	}

	function pushMessage(data) {
		var message = {};
		message.msg = true;
		message.contents = data;
		try {
			chrome.storage.sync.get(sendProperties, function (item) {
				outputCounter += 1;
				message.id = outputCounter;
				message.settings = item;
				soca.send(JSON.stringify(message));
			});
		} catch (e) {
			outputCounter += 1;
			message.id = outputCounter;
			soca.send(JSON.stringify(message));
		}
	}

	function extractKickChannelFromUrl(url) {
		try {
			var parsed = new URL(url, window.location.origin);
			var segments = parsed.pathname.split("/").filter(Boolean).map(function (segment) {
				try {
					return decodeURIComponent(segment);
				} catch (e) {
					return segment;
				}
			});

			if (!segments.length) {
				return "";
			}

			var popoutIndex = segments.indexOf("popout");
			if (popoutIndex !== -1) {
				if (segments.length > popoutIndex + 1) {
					return segments[popoutIndex + 1];
				}
			}

			var chatroomIndex = segments.indexOf("chatroom");
			if (chatroomIndex > 0) {
				return segments[chatroomIndex - 1];
			}

			if (segments[0] !== "chat") {
				return segments[0];
			}
		} catch (e) {
			//
		}
		return "";
	}

	function injectKickStyles() {
		if (document.getElementById("kick-style-overrides")) {
			return;
		}
		var style = document.createElement("style");
		style.id = "kick-style-overrides";
		style.textContent = [
			".kick-clickable{cursor:pointer!important;}",
			".kick-highlighted{outline:2px solid #f5d742;outline-offset:2px;background-color:transparent!important;}",
			".kick-shown{outline:2px solid #5ecbff;outline-offset:2px;background-color:transparent!important;}"
		].join("\n");
		var destination = document.head || document.documentElement;
		if (destination) {
			destination.appendChild(style);
		} else {
			document.addEventListener("DOMContentLoaded", function handleKickStyles() {
				document.removeEventListener("DOMContentLoaded", handleKickStyles);
				var target = document.head || document.documentElement;
				if (target && !document.getElementById("kick-style-overrides")) {
					target.appendChild(style);
				}
			});
		}
	}

	function escapeHtml(unsafe) {
		if (!unsafe && unsafe !== 0) {
			return "";
		}
		return String(unsafe)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function escapeAttribute(value) {
		if (!value && value !== 0) {
			return "";
		}
		return String(value)
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	function getAllContentNodes(element) {
		if (!element) {
			return "";
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.nodeType === 3) {
				return escapeHtml(element.textContent);
			}
			if (element.nodeType === 1) {
				if (element.tagName === "BR") {
					return "<br>";
				}
				if (element.tagName === "IMG" || element.tagName === "PICTURE" || element.tagName === "SVG") {
					return element.outerHTML;
				}
				return escapeHtml(element.textContent);
			}
			return "";
		}

		var response = "";
		element.childNodes.forEach(function (node) {
			if (node.nodeType === 3) {
				if (node.textContent && node.textContent.trim().length > 0) {
					response += escapeHtml(node.textContent);
				}
			} else if (node.nodeType === 1) {
				if (node.childNodes.length) {
					response += getAllContentNodes(node);
				} else if (node.tagName === "IMG" || node.tagName === "PICTURE" || node.tagName === "SVG") {
					response += node.outerHTML;
				} else if (node.tagName === "BR") {
					response += "<br>";
				} else {
					response += escapeHtml(node.textContent);
				}
			}
		});
		return response;
	}

	function collectMessageNodes(element) {
		var selectors = [
			"seventv-container",
			".chat-entry-content",
			".chat-emote-container",
			".seventv-painted-content",
			".break-all",
			"div span[class^='font-normal']",
			"[data-role='message']",
			"[data-chat-entry-message]"
		];
		var nodes = [];
		selectors.forEach(function (selector) {
			element.querySelectorAll(selector).forEach(function (node) {
				if (nodes.indexOf(node) === -1) {
					nodes.push(node);
				}
			});
		});
		return nodes;
	}

	function extractMessageHtml(element) {
		var nodes = collectMessageNodes(element);
		var html = "";

		if (nodes.length) {
			nodes.forEach(function (node) {
				var chunk = getAllContentNodes(node);
				if (chunk && chunk.trim().length) {
					if (html.length) {
						html += " ";
					}
					html += chunk.trim();
				}
			});
		}

		if (html.trim().length === 0) {
			var fallback = element.querySelector("[data-chat-message-text]") || element.querySelector("div span[class*='font-normal']");
			if (fallback) {
				html = getAllContentNodes(fallback).trim();
			}
		}

		return html.trim();
	}

	function extractBadges(element) {
		var html = "";
		try {
			var badgeNodes = element.querySelectorAll(".chat-message-identity .badge-tooltip img[src], .chat-message-identity .badge-tooltip svg, .chat-message-identity .badge img[src], .chat-message-identity .badge svg, .chat-entry .badge img[src], .chat-entry .badge svg, div[data-state] img[src], div[data-state] svg");
			badgeNodes.forEach(function (badge) {
				if (badge.tagName === "IMG") {
					var src = badge.getAttribute("src");
					if (src) {
						html += '<img src="' + escapeAttribute(src) + '" alt="' + escapeAttribute(badge.getAttribute("alt") || "") + '">';
					}
				} else if (badge.tagName && badge.tagName.toLowerCase() === "svg") {
					html += badge.outerHTML;
				}
			});
		} catch (e) {
			//
		}
		return html;
	}

	function extractNameColor(element) {
		var nameNode = element.querySelector("button[title]") || element.querySelector(".chat-entry-username");
		if (nameNode && nameNode.style && nameNode.style.color) {
			return nameNode.style.color;
		}
		return "";
	}

	function normalizeName(raw) {
		if (!raw) {
			return "";
		}
		var name = raw.replace("Channel Host", "").replace(":", "").trim();
		if (showOnlyFirstName) {
			name = name.replace(/ .*/, "");
		}
		return name;
	}

	function getChatName(element) {
		var nameNode = element.querySelector("button[title]") || element.querySelector(".chat-entry-username") || element.querySelector("[data-chat-entry-author]");
		if (!nameNode) {
			return "";
		}
		return normalizeName(nameNode.textContent || "");
	}

	function extractDonation(element) {
		var donationNode = element.querySelector("[class*='donation'], [class*='tip'], [data-tip], [data-gifted], [class*='train']");
		if (donationNode) {
			var content = donationNode.textContent || "";
			content = content.trim();
			if (content.length) {
				return '<div class="donation">' + escapeHtml(content) + "</div>";
			}
		}
		return "";
	}

	function extractMembership(element) {
		var membershipNode = element.querySelector("[class*='subscrib'], [data-subscriber], [data-gifted]");
		if (membershipNode) {
			var text = membershipNode.textContent || "";
			text = text.trim();
			if (text.length) {
				return '<div class="donation membership">' + escapeHtml(text) + "</div>";
			}
		}
		return "";
	}

	function extractAvatarFromDom(element) {
		var avatarNode = element.querySelector("img[alt*='avatar'], img[alt*='Avatar'], img[class*='avatar'], img[class*='profile'], picture img");
		if (avatarNode && avatarNode.src) {
			return avatarNode.src;
		}
		return "";
	}

	async function getKickAvatarImage(username) {
		if (!username) {
			return "";
		}

		var key = username.toLowerCase();
		if (avatarCache[key]) {
			return avatarCache[key];
		}

		if (!kickChannel) {
			return "";
		}

		try {
			var response = await fetchWithTimeout("https://kick.com/channels/" + encodeURIComponent(kickChannel) + "/" + encodeURIComponent(username), 4000);
			if (!response || !response.ok) {
				return "";
			}
			var data = await response.json();
			if (data && data.profilepic) {
				avatarCache[key] = data.profilepic;
				return data.profilepic;
			}
		} catch (e) {
			//
		}
		return "";
	}

	async function resolveAvatar(element, username) {
		var avatar = extractAvatarFromDom(element);
		if (avatar) {
			return avatar;
		}
		return await getKickAvatarImage(username);
	}

	function isKickMessageElement(node) {
		if (!node || !node.matches) {
			return false;
		}
		if (node.matches(".chat-message, [data-chat-entry], .chat-entry")) {
			return true;
		}
		if (node.matches("div[data-index]")) {
			return true;
		}
		return false;
	}

	function findKickMessageElement(startNode) {
		if (!startNode) {
			return null;
		}
		var message = startNode.closest(".chat-message, [data-chat-entry], .chat-entry");
		if (message) {
			return message;
		}
		var indexContainer = startNode.closest("div[data-index]");
		if (indexContainer) {
			if (indexContainer.querySelector("button[title], .chat-entry-username, [data-chat-entry-author]")) {
				return indexContainer;
			}
		}
		var hoverContainer = startNode.closest(".betterhover\\:group-hover\\:bg-shade-lower");
		if (hoverContainer) {
			if (hoverContainer.querySelector("button[title], .chat-entry-username, [data-chat-entry-author]")) {
				return hoverContainer;
			}
		}
		return null;
	}

	function resolveHighlightTarget(element) {
		if (!element) {
			return null;
		}
		if (element.matches(".betterhover\\:group-hover\\:bg-shade-lower")) {
			return element;
		}
		var target = element.querySelector(".betterhover\\:group-hover\\:bg-shade-lower");
		if (target) {
			return target;
		}
		var inline = element.querySelector(".inline-flex.cursor-pointer");
		if (inline) {
			return inline;
		}
		return element;
	}

	function markKickClickable(element) {
		if (!element || !element.classList) {
			return;
		}
		element.classList.add(KICK_CLICKABLE_CLASS);
	}

	function applyHighlightClass(element) {
		if (!element) {
			return;
		}
		var target = resolveHighlightTarget(element);
		if (!target || !target.classList) {
			return;
		}
		markKickClickable(target);
		target.classList.remove("highlighted-comment");
		if (!highlightWordSet.length) {
			target.classList.remove(KICK_HIGHLIGHT_CLASS);
			return;
		}
		var text = (target.textContent || element.textContent || "").toLowerCase();
		var matched = highlightWordSet.some(function (word) {
			return word && text.indexOf(word) !== -1;
		});
		if (matched) {
			target.classList.add(KICK_HIGHLIGHT_CLASS);
		} else {
			target.classList.remove(KICK_HIGHLIGHT_CLASS);
		}
	}

	function reapplyHighlights() {
		var elements = document.querySelectorAll(KICK_MESSAGE_SELECTOR);
		elements.forEach(function (node) {
			applyHighlightClass(node);
		});
	}

	function startHighlightObserver() {
		var observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				mutation.addedNodes.forEach(function (node) {
					if (!(node instanceof HTMLElement)) {
						return;
					}
					if (isKickMessageElement(node)) {
						applyHighlightClass(node);
					} else if (node.querySelectorAll) {
						node.querySelectorAll(KICK_MESSAGE_SELECTOR).forEach(function (child) {
							applyHighlightClass(child);
						});
					}
				});
			});
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	async function buildMessageData(element) {
		var chatname = getChatName(element);
		if (!chatname) {
			return null;
		}

		var chatmessage = extractMessageHtml(element);
		var hasDonation = extractDonation(element);
		var hasMembership = extractMembership(element);

		if (!chatmessage && !hasDonation && !hasMembership) {
			return null;
		}

		var data = {};
		data.chatname = chatname;
		data.chatbadges = extractBadges(element);
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = await resolveAvatar(element, chatname);
		data.hasDonation = hasDonation;
		data.hasMembership = hasMembership;
		data.type = "kick";

		var nameColor = extractNameColor(element);
		if (nameColor) {
			data.nameColor = nameColor;
		}

		return data;
	}

	async function handleMessageClick(element) {
		if (!soca) {
			actionwtf();
		}
		var data = await buildMessageData(element);
		if (!data) {
			return;
		}
		if (element.classList) {
			element.classList.add("shown-comment");
			element.classList.remove(KICK_HIGHLIGHT_CLASS);
			element.classList.remove("highlighted-comment");
		}
		var highlightTarget = resolveHighlightTarget(element);
		if (highlightTarget && highlightTarget.classList) {
			markKickClickable(highlightTarget);
			highlightTarget.classList.add("shown-comment");
			highlightTarget.classList.add(KICK_SHOWN_CLASS);
			highlightTarget.classList.remove(KICK_HIGHLIGHT_CLASS);
			highlightTarget.classList.remove("highlighted-comment");
		}
		pushMessage(data);
	}

	function createControlButton(id, className, label, onClick) {
		var button = document.createElement("button");
		button.id = id;
		button.type = "button";
		button.textContent = label;
		button.className = className;
		button.addEventListener("click", function (event) {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		});
		return button;
	}

	function ensureControlButtons() {
		if (!document.body) {
			return;
		}

		if (!document.getElementById("kickClearButton")) {
			var clearButton = createControlButton("kickClearButton", "btn-clear-twitch", "CLEAR", function () {
				if (!soca) {
					actionwtf();
				}
				pushMessage(false);
			});
			document.body.appendChild(clearButton);
		}

		if (!document.getElementById("kickOverlayButton")) {
			var overlayButton = createControlButton("kickOverlayButton", "btn-getoverlay-twitch", "LINK", function () {
				if (!soca) {
					actionwtf();
				}
				prompt("Overlay Link: https://chat.overlay.ninja?session=" + channel + "\nAdd as a browser source; set height to 250px", "https://chat.overlay.ninja?session=" + channel);
			});
			document.body.appendChild(overlayButton);
		}
	}

	document.addEventListener("DOMContentLoaded", function () {
		ensureControlButtons();
	});
	setTimeout(ensureControlButtons, 500);
	setTimeout(ensureControlButtons, 2500);

	document.addEventListener("click", function (event) {
		var target = event.target;
		if (!target) {
			return;
		}
		var messageEl = findKickMessageElement(target);
		if (!messageEl) {
			return;
		}
		handleMessageClick(messageEl);
	});

	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape" && !event.repeat) {
			if (!soca) {
				actionwtf();
			}
			pushMessage(false);
		}
	});

	function applyBrandSettings(item) {
		var root = document.documentElement;
		if (item.color) {
			root.style.setProperty("--keyer-bg-color", item.color);
		}
		if (item.authorBackgroundColor) {
			root.style.setProperty("--author-bg-color", item.authorBackgroundColor);
			root.style.setProperty("--author-avatar-border-color", item.authorBackgroundColor);
		}
		if (item.authorAvatarBorderColor) {
			root.style.setProperty("--author-avatar-border-color", item.authorAvatarBorderColor);
		}
		if (item.commentBackgroundColor) {
			root.style.setProperty("--comment-bg-color", item.commentBackgroundColor);
		}
		if (item.authorColor) {
			root.style.setProperty("--author-color", item.authorColor);
		}
		if (item.commentColor) {
			root.style.setProperty("--comment-color", item.commentColor);
		}
		if (item.fontFamily) {
			root.style.setProperty("--font-family", item.fontFamily);
		}
		if (item.scale) {
			root.style.setProperty("--comment-scale", item.scale);
		}
		if (item.commentBottom) {
			root.style.setProperty("--comment-area-bottom", item.commentBottom);
		}
		if (item.commentHeight) {
			root.style.setProperty("--comment-area-height", item.commentHeight);
		}
		if (item.sizeOffset) {
			root.style.setProperty("--comment-area-size-offset", item.sizeOffset);
		}
	}

	var properties = ["color", "scale", "streamID", "sizeOffset", "commentBottom", "commentHeight", "authorBackgroundColor", "authorAvatarBorderColor", "authorColor", "commentBackgroundColor", "commentColor", "fontFamily", "showOnlyFirstName", "highlightWords"];

	chrome.storage.sync.get(properties, function (item) {
		if (item.streamID) {
			channel = item.streamID;
		} else {
			chrome.storage.sync.set({
				streamID: channel
			});
			chrome.runtime.lastError;
		}

		showOnlyFirstName = !!item.showOnlyFirstName;
		highlightWords = Array.isArray(item.highlightWords) ? item.highlightWords : [];
		highlightWordSet = highlightWords.map(function (word) {
			if (typeof word === "string") {
				return word.toLowerCase();
			}
			return "";
		}).filter(function (word) {
			return word.length > 0;
		});

		applyBrandSettings(item);
		reapplyHighlights();
	});

	startHighlightObserver();
	setTimeout(function () {
		actionwtf();
	}, 500);

	async function fetchWithTimeout(url, timeout) {
		if (!timeout && timeout !== 0) {
			timeout = 4000;
		}
		var controller = new AbortController();
		var timer = setTimeout(function () {
			controller.abort();
		}, timeout);
		try {
			var response = await fetch(url, { signal: controller.signal });
			clearTimeout(timer);
			return response;
		} catch (e) {
			clearTimeout(timer);
			return null;
		}
	}
})();
