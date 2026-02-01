/**
 * GTranslate Addon - Frontend Translation Handler
 * 
 * Handles custom translations on the frontend
 * 
 * @package GTranslateAddon
 * @version 2.0
 */

(function($){
	"use strict";

	/**
     * Translation Manager
     */
	const GTAddonPublic = {

		config: {
			elementSelector: $('.notranslate'),
			cookieName: 'googtrans',
			observerDebounceMs: 150,
			langAttributeName: 'lang'
		},

		state: {
			currentLanguage: null,
			isInitialized: false,
			translationCache: new Map(),
			observer: null,
			debounceTimer: null
		},

		init: function() {
			if (!this.validateEnvironment()) {
				return;
			}

			try {
				this.state.currentLanguage = this.getCurrentLanguage();
				this.translatePage();
				this.setupLanguageObserver();
				this.state.isInitialized = true;

// 				console.log('GTAddon: Initialized successfully', {
// 					language: this.state.currentLanguage,
// 					translationCount: this.getTranslationCount()
// 				});

			} catch (error) {
				console.error('GTAddon: Initialization failed:', error);
			}
		},

		/**
         * Validate that the environment is ready
         * 
         * @return {boolean} True if environment is valid
         */
		validateEnvironment: function() {
			if (typeof gtAddonHelper === 'undefined') {
				console.warn('GTAddon: Configuration object not found. Plugin may not be properly enqueued.');
				return false;
			}

			if (!gtAddonHelper.translationPairs || 
				typeof gtAddonHelper.translationPairs !== 'object') {
				console.warn('GTAddon: Translation pairs missing or invalid.');
				return false;
			}

			if (!gtAddonHelper.defaultLanguage || 
				typeof gtAddonHelper.defaultLanguage !== 'string') {
				console.warn('GTAddon: Default language missing or invalid.');
				return false;
			}

			if (Object.keys(gtAddonHelper.translationPairs).length === 0) {
				console.info('GTAddon: No translations configured.');
				return false;
			}

			return true;
		},

		/**
         * Get the current language from cookie
         * 
         * @return {string} Current language code
         */
		getCurrentLanguage: function() {
			try {
				const cookieRegex = new RegExp('(?:^|;\\s*)' + this.config.cookieName + '=([^;]*)');
				const match = document.cookie.match(cookieRegex);

				if (!match) {
					return gtAddonHelper.defaultLanguage;
				}

				const cookieValue = decodeURIComponent(match[1]);
				const parts = cookieValue.split('/');
				const langCode = parts.length >= 3 ? parts[2] : '';

				if (this.isValidLanguageCode(langCode)) {
					return langCode;
				}

			} catch (error) {
				console.error('GTAddon: Error parsing language cookie:', error);
			}

			return gtAddonHelper.defaultLanguage;
		},

		/**
         * Validate a language code
         * 
         * @param {string} code Language code to validate
         * @return {boolean} True if valid
         */
		isValidLanguageCode: function(code) {
			return typeof code === 'string' && /^[a-z]{2,5}$/i.test(code);
		},

		/**
         * Get translation count for current or specified language
         * 
         * @param {string} [language] Language code (defaults to current)
         * @return {number} Number of translations
         */
		getTranslationCount: function(language) {
			language = language || this.state.currentLanguage;
			const translations = this.getTranslationsForLanguage(language);
			return Object.keys(translations).length;
		},

		/**
         * Get translations for a specific language
         * 
         * @param {string} language Language code
         * @return {Object} Translation pairs for the language
         */
		getTranslationsForLanguage: function(language) {
			const pairs = gtAddonHelper.translationPairs;

			if (pairs[language] && typeof pairs[language] === 'object') {
				return pairs[language];
			}

			return pairs;
		},

		/**
         * Translate the entire page
         */
		translatePage: function() {
			try {
				const currentLang = this.state.currentLanguage;
				const defaultLang = gtAddonHelper.defaultLanguage;

				if (currentLang === defaultLang) {
					this.translateToDefault();
				} else {
					this.translateFromDefault(currentLang);
				}

			} catch (error) {
				console.error('GTAddon: Translation error:', error);
			}
		},

		/**
         * Translate from default language to target language
         * 
         * @param {string} targetLanguage Target language code
         */
		translateFromDefault: function(targetLanguage) {
			const translations = this.getTranslationsForLanguage(targetLanguage);

			if (Object.keys(translations).length === 0) {
				console.info('GTAddon: No translations available for language:', targetLanguage);
				return;
			}

			const $elements = this.config.elementSelector;

			if ($elements.length === 0) {
				return;
			}

			Object.keys(translations).forEach((sourceText) => {
				const targetText = translations[sourceText];

				if (!sourceText || !targetText) {
					return;
				}

				this.translateElements($elements, sourceText, targetText, targetLanguage);
			});
		},

		/**
         * Translate back to default language
         */
		translateToDefault: function() {
			const currentLang = this.state.currentLanguage;
			const translations = this.getTranslationsForLanguage(currentLang);

			const reverseMap = {};
			Object.keys(translations).forEach((source) => {
				const target = translations[source];
				if (target && !reverseMap[target]) {
					reverseMap[target] = source;
				}
			});

			const $elements = this.config.elementSelector;

			if ($elements.length === 0) {
				return;
			}

			Object.keys(reverseMap).forEach((translatedText) => {
				const originalText = reverseMap[translatedText];

				this.translateElements(
					$elements, 
					translatedText, 
					originalText, 
					gtAddonHelper.defaultLanguage
				);
			});
		},

		/**
         * Translate matching elements
         * 
         * SECURITY: Uses .filter() instead of selector injection to prevent XSS
         * PERFORMANCE: Filters pre-queried elements instead of new DOM query
         * 
         * @param {jQuery} $elements Pre-queried elements to search
         * @param {string} sourceText Text to find (exact match)
         * @param {string} targetText Text to replace with
         * @param {string} targetLanguage Target language code
         */
		translateElements: function($elements, sourceText, targetText, targetLanguage) {
			sourceText = String(sourceText).trim();
			targetText = String(targetText).trim();

			if (!sourceText || !targetText) {
				return;
			}

			const $matches = $elements.filter(function() {
				const elementText = $(this).text().trim();
				return elementText === sourceText;
			});

			$matches.each(function() {
				const $element = $(this);

				if ($element.children().length === 0) {
					$element.text(targetText);

					$element.attr(GTAddonPublic.config.langAttributeName, targetLanguage);
				}
			});

			if (this.isDebugMode()) {
				console.log('GTAddon: Translated', {
					from: sourceText,
					to: targetText,
					count: $matches.length,
					language: targetLanguage
				});
			}
		},

		/**
         * Setup MutationObserver to detect language changes
         */
		setupLanguageObserver: function() {
			if (this.state.observer) {
				this.state.observer.disconnect();
			}

			this.state.observer = new MutationObserver((mutations) => {
				this.handleLanguageChange(mutations);
			});

			this.state.observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: [this.config.langAttributeName]
			});
		},

		/**
         * Handle language change
         * 
         * @param {MutationRecord[]} mutations Mutation records
         */
		handleLanguageChange: function(mutations) {
			let langChanged = false;

			for (const mutation of mutations) {
				if (mutation.type === 'attributes' && 
					mutation.attributeName === this.config.langAttributeName) {
					langChanged = true;
					break;
				}
			}

			if (!langChanged) {
				return;
			}

			clearTimeout(this.state.debounceTimer);
			this.state.debounceTimer = setTimeout(() => {
				this.onLanguageChanged();
			}, this.config.observerDebounceMs);
		},

		/**
         * Called when language has changed
         */
		onLanguageChanged: function() {
			try {
				const newLanguage = this.getCurrentLanguage();

				if (newLanguage !== this.state.currentLanguage) {
					console.log('GTAddon: Language changed', {
						from: this.state.currentLanguage,
						to: newLanguage
					});

					this.state.currentLanguage = newLanguage;
					this.translatePage();
				}

			} catch (error) {
				console.error('GTAddon: Error handling language change:', error);
			}
		},

		/**
         * Check if debug mode is enabled
         * 
         * @return {boolean} True if debug mode is on
         */
		isDebugMode: function() {
			if (window.location.search.includes('gtaddon_debug=1')) {
				return true;
			}

			if (gtAddonHelper.debug === true) {
				return true;
			}

			return false;
		},

		/**
         * Cleanup resources
         */
		cleanup: function() {
			if (this.state.observer) {
				this.state.observer.disconnect();
				this.state.observer = null;
			}

			if (this.state.debounceTimer) {
				clearTimeout(this.state.debounceTimer);
				this.state.debounceTimer = null;
			}

			this.state.translationCache.clear();
			this.state.isInitialized = false;
		},

		/**
         * Public API: Manually trigger translation
         * Useful for dynamically loaded content
         */
		retranslate: function() {
			if (!this.state.isInitialized) {
				console.warn('GTAddon: Not initialized. Call init() first.');
				return;
			}

			this.translatePage();
		},

		/**
         * Public API: Get current language
         * 
         * @return {string} Current language code
         */
		getLanguage: function() {
			return this.state.currentLanguage;
		}
	};

	$(document).ready(function() {
		GTAddonPublic.init();
	});

	/**
     * Cleanup on page unload (important for SPAs)
     */
// 	not for this website
// 	$(window).on('unload', function() {
// 		GTAddonPublic.cleanup();
// 	});
	
})(jQuery);
