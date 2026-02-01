ELP GTranslate Custom Translation Bridge
🚀 The Problem & The Mission

This plugin was developed for Frida (https://frida-art.eu/), a community of female artists with a limited budget. They were using the free version of the GTranslate plugin but needed to manually override specific phrases for better UX and artistic context.

Since the budget didn't allow for GTranslate Pro or ACF Pro, I built a custom, lightweight solution that provides "repeater" functionality, and dynamic frontend translation without heavy dependencies.

🛠 Technical Highlights

Custom AJAX-powered Repeater: Instead of relying on ACF Pro, I developed a custom admin UI with a vanilla JavaScript/jQuery repeater. It handles dynamic row addition/deletion and saves data via the WordPress Options API with full AJAX support.

MutationObserver Integration: To ensure custom translations are applied even when GTranslate dynamically changes the DOM, I used MutationObserver on the frontend for real-time DOM monitoring and phrase replacement.

Security First: Implemented WordPress nonces for all AJAX actions and rigorous data sanitization/escaping (PHP absint, esc_attr, esc_html) to prevent XSS and CSRF attacks.

Performance Optimized: Data is fetched efficiently, and the frontend script is scoped to minimize its footprint on page load speeds.

✨ Features

Budget-Friendly: Provides manual translation overrides without expensive licenses.

Developer-Centric UI: A clean, native-feeling WordPress settings page.

Dynamic Translation: Works seamlessly with GTranslate’s language switcher.

Zero Dependencies: No need for third-party "Repeater" plugins.

📦 Installation & Usage

Upload the plugin folder to /wp-content/plugins/.
Activate via the WordPress Dashboard.
Navigate to Settings > GTranslate Addon.

Add your "Source Phrase" (in the original language) and the "Target Translation".

Save and check the frontend!

💻 Tech Stack
Backend: PHP, WordPress Options API, AJAX.
Frontend: JavaScript (jQuery), MutationObserver API.
Styling: CSS3 (Flexbox for admin UI).
