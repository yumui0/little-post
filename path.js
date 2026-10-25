/*
  Little Post – card catalogue
  ----------------------------
  Each category is one shelf in the shop. To add a card, drop an image into
  res/<category>/ and add a line to that category's `cards` list.
  Optional per card:
    caption – greeting printed over the cover (use it for artwork without text)
    capY    – where the caption sits, as a % from the top of the cover (default 50)
    fave    – true shows a "Fan favourite" sticker
    free    – true makes the card free to try (also set its price_cents to 0 in the database)
    added   – date (YYYY-MM-DD) the card joined the shop; newest cards show under New arrivals
    style   – optional; otherwise taken from STYLE_OF below
  IMPORTANT: keep the order of existing cards – shared links point at the position (templ) in the list.
*/
const SHOP = {
	categories: [
		{
			id: "birthday", title: "Birthday", tint: "#ffd3e1",
			messages: [
				"Happy birthday! I hope your day is full of cake, laughter and everything you love.",
				"Another year of you, another reason to celebrate. Have the best day!",
				"Wishing you a year as sweet as the biggest slice of cake."
			],
			cards: [
				{ src: "res/birthday/1.png", name: "Midnight confetti", free: true },
				{ src: "res/birthday/2.png", name: "Party hats" },
				{ src: "res/birthday/3.png", name: "Sweet cake", fave: true },
				{ src: "res/birthday/4.png", name: "Balloon mail" },
				{ src: "res/birthday/5.png", name: "Wildflower" },
				{ src: "res/birthday/6.png", name: "Golden confetti" },
				{ src: "res/birthday/7.png", name: "Pop art party" },
				{ src: "res/birthday/8.png", name: "Pink candle" },
				{ src: "res/birthday/9.png", name: "Cake slices" },
				{ src: "res/birthday/10.png", name: "Kitty party", added: "2026-10-24" }
			]
		},
		{
			id: "thankyou", title: "Thank you", tint: "#ffe7a3",
			messages: [
				"Thank you so much. It meant more to me than you know.",
				"I'm grateful for you and everything you did. Thank you!",
				"You made my day. Thank you for being so kind."
			],
			cards: [
				{ src: "res/thankyou/1.png", name: "Panda hugs", fave: true },
				{ src: "res/thankyou/2.png", name: "Donut thanks" },
				{ src: "res/thankyou/3.png", name: "Night garden" },
				{ src: "res/thankyou/4.png", name: "Autumn leaves" },
				{ src: "res/thankyou/5.png", name: "Pop thanks", free: true },
				{ src: "res/thankyou/6.jpg", name: "Navy ribbons", added: "2026-10-25" },
				{ src: "res/thankyou/7.jpg", name: "Pink checkers", added: "2026-10-25" }
			]
		},
		{
			id: "anniversary", title: "Anniversary", tint: "#e0d3f8",
			messages: [
				"Happy anniversary! Every year with you is my favourite.",
				"Cheers to us, and to all the years still to come.",
				"Thank you for being my person, today and every day."
			],
			cards: [
				{ src: "res/anniversary/1.png", name: "Teal romance", free: true },
				{ src: "res/anniversary/2.png", name: "Floral wreath" },
				{ src: "res/anniversary/3.png", name: "Cheers for the years", fave: true }
			]
		},
		{
			id: "congrats", title: "Congratulations", tint: "#c6e5ff",
			messages: [
				"Congratulations! You worked hard for this and you deserve every bit of it.",
				"Huge news and so well earned. I'm cheering for you!",
				"You did it! Time to celebrate."
			],
			cards: [
				{ src: "res/congrats/1.jpg", name: "Golden frame", added: "2026-10-25" },
				{ src: "res/congrats/2.png", name: "Proud dino", added: "2026-10-25" },
				{ src: "res/congrats/3.png", name: "You did it", free: true, added: "2026-10-25" },
				{ src: "res/congrats/4.jpg", name: "Colourful congrats", added: "2026-10-25" },
				{ src: "res/congrats/5.png", name: "You're a star", added: "2026-10-25" },
				{ src: "res/congrats/6.png", name: "Good boy star", added: "2026-10-25" },
				{ src: "res/congrats/7.png", name: "Good girl star", added: "2026-10-25" }
			]
		},
		{
			id: "graduation", title: "Graduation", tint: "#ffd9bd",
			messages: [
				"Congratulations, graduate! All that hard work paid off.",
				"So proud of you. The future looks bright.",
				"You made it! Go and celebrate."
			],
			cards: [
				{ src: "res/graduation/1.png", name: "Game over", added: "2026-10-25" },
				{ src: "res/graduation/2.png", name: "Chalkboard grad", added: "2026-10-25" },
				{ src: "res/graduation/3.jpg", name: "You did it", added: "2026-10-25" },
				{ src: "res/graduation/4.jpg", name: "GraduATE", free: true, added: "2026-10-25" }
			]
		},
		{
			id: "love", title: "Love", tint: "#ffd3e1",
			messages: [
				"I love you. I just wanted you to see it written down.",
				"You're on my mind today, and most days.",
				"Thank you for being you. I'm so lucky to have you."
			],
			cards: [
				{ src: "res/love/6.png", name: "Cherry blossom kiss", added: "2026-10-24" },
				{ src: "res/love/4.png", name: "Winking kitten", free: true },
				{ src: "res/love/5.png", name: "Kitty kiss", added: "2026-10-24" },
				{ src: "res/love/7.png", name: "Love hug", added: "2026-10-25" },
				{ src: "res/love/8.png", name: "My love", added: "2026-10-25" }
			]
		},
		{
			id: "sorry", title: "Sorry", tint: "#e0d3f8",
			messages: [
				"I'm sorry. I should have done better, and I'd like to make it right.",
				"I'm sorry for what I said. You matter a lot to me.",
				"I miss you, and I'm sorry. Can we talk?"
			],
			cards: [
				{ src: "res/sorry/2.jpg", name: "Sad frog", added: "2026-10-25" },
				{ src: "res/sorry/3.png", name: "Teary doodle", added: "2026-10-25" },
				{ src: "res/sorry/4.jpg", name: "Sad hamster", added: "2026-10-25" },
				{ src: "res/sorry/5.jpg", name: "Sad kitty", added: "2026-10-25" },
				{ src: "res/sorry/6.png", name: "I'm sorry kitten", added: "2026-10-25" },
				{ src: "res/sorry/7.png", name: "Stencil sorry", free: true, added: "2026-10-25" }
			]
		},
		{
			id: "christmas", title: "Christmas", tint: "#c4ebd5",
			messages: [
				"Merry Christmas! Wishing you a cosy, joyful holiday.",
				"Happy holidays! I hope your days are warm and full of good food.",
				"Sending you lots of love this festive season."
			],
			cards: [
				{ src: "res/christmas/1.png", name: "Festive wishes", free: true },
				{ src: "res/christmas/2.png", name: "Santa kitty" }
			]
		}
		,{
			id: "valentine", title: "Valentine's Day", tint: "#ffd3e1",
			messages: [
				"Happy Valentine's Day! You make every ordinary day feel a little bit magic.",
				"Be my Valentine? I'd pick you every single year.",
				"Roses are red, this card is cute, and I'm really glad you're mine."
			],
			cards: [
				{ src: "res/valentine/3.png", name: "Be mine", added: "2026-10-25", fave: true },
				{ src: "res/valentine/5.png", name: "Bow tie kitties", added: "2026-10-25" },
				{ src: "res/valentine/6.jpg", name: "Vintage arrow", free: true, added: "2026-10-25" },
				{ src: "res/valentine/7.jpg", name: "With love always", added: "2026-10-25" },
				{ src: "res/valentine/8.png", name: "Lace heart bear", added: "2026-10-25" }
			]
		},
		{
			id: "halloween", title: "Halloween", tint: "#ffd9bd",
			messages: [
				"Happy Halloween! Eat too much candy and stay out past bedtime.",
				"Wishing you a spooky, silly and sweet Halloween.",
				"Boo! Just popping by to say have a fang-tastic night."
			],
			cards: [
				{ src: "res/halloween/1.png", name: "Halloween town", added: "2026-10-25" },
				{ src: "res/halloween/3.jpg", name: "Spooky night", added: "2026-10-25" },
				{ src: "res/halloween/4.jpg", name: "Orange bat", free: true, added: "2026-10-25" },
				{ src: "res/halloween/5.jpg", name: "Blocky haunted house", added: "2026-10-25" }
			]
		},
		{
			id: "easter", title: "Easter", tint: "#c4ebd5",
			messages: [
				"Happy Easter! I hope your day is full of spring flowers and chocolate eggs.",
				"Hoppy Easter to you and the people you love.",
				"Wishing you a bright, warm and sweet Easter."
			],
			cards: [
				{ src: "res/easter/1.png", name: "Spring bunny", free: true, added: "2026-10-25" },
				{ src: "res/easter/2.png", name: "Easter basket kitty", added: "2026-10-25" },
				{ src: "res/easter/3.png", name: "Bunny ears", added: "2026-10-25" }
			]
		},
		{
			id: "mothers", title: "Mother's Day", tint: "#ffd3e1",
			messages: [
				"Happy Mother's Day! Thank you for everything you do, every single day.",
				"You taught me what love looks like. I'm so grateful for you.",
				"To the best mum in the world: I love you more than words can say."
			],
			cards: [
				{ src: "res/mothers/1.jpg", name: "Dear Mom", added: "2026-10-25" },
				{ src: "res/mothers/2.jpg", name: "Best mom in the world", added: "2026-10-25" },
				{ src: "res/mothers/3.jpg", name: "Lilac love", added: "2026-10-25" },
				{ src: "res/mothers/4.png", name: "Line-art tulips", free: true, added: "2026-10-25" },
				{ src: "res/mothers/5.png", name: "Big hug", added: "2026-10-25" },
				{ src: "res/mothers/6.png", name: "I love my mom", added: "2026-10-25" }
			]
		},
		{
			id: "fathers", title: "Father's Day", tint: "#c6e5ff",
			messages: [
				"Happy Father's Day! Thank you for always being in my corner.",
				"You're my hero, my teacher and my favourite person to laugh with.",
				"To the best dad around: thank you for everything."
			],
			cards: [
				{ src: "res/fathers/1.png", name: "Little pink heart", free: true, added: "2026-10-25" },
				{ src: "res/fathers/2.png", name: "Swirly script", added: "2026-10-25" },
				{ src: "res/fathers/3.jpg", name: "Striped tie", added: "2026-10-25" },
				{ src: "res/fathers/4.png", name: "Heart frame", added: "2026-10-25" },
				{ src: "res/fathers/5.png", name: "Element of life", added: "2026-10-25" }
			]
		},
		{
			id: "thinking", title: "Thinking of you", tint: "#c6e5ff",
			messages: [
				"I was thinking of you today and wanted you to know.",
				"No reason, just a little hello and a big hug from me.",
				"Sending you warm thoughts, wherever you are."
			],
			cards: [
				{ src: "res/thinking/3.png", name: "Daydreaming cat", added: "2026-10-25" },
				{ src: "res/thinking/4.png", name: "Flower power", added: "2026-10-25" },
				{ src: "res/thinking/5.png", name: "Daydreaming bunny", added: "2026-10-25" },
				{ src: "res/thinking/6.jpg", name: "Thought bubble", free: true, added: "2026-10-25" }
			]
		}
	]
};


/* ---------- shop metadata (display order, blurbs, styles, ids, price) ---------- */
const PRICE_CENTS = 0; // 0 = the whole shop is free (no Stripe). Display only: the server reads the real price from the database.
const priceOf = card => card.free ? 0 : PRICE_CENTS; // free: true cards cost nothing (display only, like PRICE_CENTS)
const CURRENCY = "EUR";

/* order of occasions in the shop */
const ORDER = ["birthday","anniversary","love","valentine","christmas","halloween","easter","graduation","mothers","fathers",
	"thankyou","thinking","congrats","sorry"];

const BLURBS = {
	birthday: "Send birthday smiles", anniversary: "Make the day extra special", love: "Say it with a card",
	valentine: "For your favourite person", christmas: "Cosy festive wishes", halloween: "Say boo!",
	easter: "Hop into spring", graduation: "Celebrate the big day", mothers: "Show Mum some love",
	fathers: "For the dads we adore", thankyou: "Show your gratitude",
	thinking: "Send happy thoughts", congrats: "Cheer someone on", sorry: "Say it kindly"
};

/* style filters: cute, floral, bold, elegant, playful */
const STYLE_OF = {
	"birthday:0": "bold", "birthday:1": "playful", "birthday:2": "playful", "birthday:3": "cute", "birthday:4": "floral",
	"birthday:5": "bold", "birthday:6": "bold", "birthday:7": "elegant", "birthday:8": "bold",
	"thankyou:0": "cute", "thankyou:1": "cute", "thankyou:2": "floral", "thankyou:3": "floral", "thankyou:4": "bold",
	"anniversary:0": "elegant", "anniversary:1": "floral", "anniversary:2": "playful"
};
const STYLES = [["cute", "Cute"], ["floral", "Floral"], ["bold", "Bold"], ["elegant", "Elegant"], ["playful", "Playful"]];

/* give every card a stable id (used by the cart, the database and Stripe) and fill in defaults */
SHOP.categories.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)); // sort is only for display; ids never use position
SHOP.categories.forEach(cat => {
	cat.blurb = BLURBS[cat.id] || "";
	cat.cards.forEach((card, idx) => {
		card.id = `${cat.id}-${idx + 1}`;   // position in the ORIGINAL list. Never reorder cards inside a category.
		card.cat = cat.id;
		card.style = card.style || STYLE_OF[`${cat.id}:${idx}`] || "cute";
		card.added = card.added || "2026-01-15";
		// small copy for shelves (made by scripts/make-thumbs.py). SVG cards are already tiny. A missing thumb falls back to the full image.
		card.thumb = /\.png$/i.test(card.src) ? card.src.replace(/^res\//, "res/thumbs/").replace(/\.png$/i, ".webp") : card.src;
	});
});

/* Shared helpers (used by the shop and the card page) */
const findCategory = id => SHOP.categories.find(c => c.id === id);

/* Cover markup: the artwork plus an optional printed caption.
   Pass thumb = true on shelves and lists to use the small copy; big views use the full image. */
function coverHTML(card, alt = "", thumb = false) {
	const cap = card.caption
		? `<span class="cap" style="--y:${card.capY ?? 50}%">${card.caption}</span>`
		: "";
	const small = thumb && card.thumb && card.thumb !== card.src;
	return `<img src="${small ? card.thumb : card.src}"${small ? ` data-full="${card.src}"` : ""} alt="${alt}" width="1400" height="1000" decoding="async">${cap}`;
}

/* Text <-> URL-safe base64 that also handles emoji and accents.
   Old links (plain btoa of ASCII text) decode the same way. */
const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = s => { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return ""; } };
