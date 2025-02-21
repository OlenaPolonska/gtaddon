(function($){
	"use strict";

	$(document).ready( function() {
		
		customTranslateToEnglish();
		let lang_observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.type === "attributes") {
					customTranslateToEnglish();
				}
			});
		});		

		const htmlElement = document.getElementsByTagName("html")[0];
		lang_observer.observe( htmlElement, {
			attributes: true
		});
	});

	function customTranslateToEnglish() {
		const translations = gtHelper.translationPairs;
		
		if ( gt_get_lang() !== gtHelper.defaultLanguage ) {
			Object.keys(translations).forEach(function( key ) {
				$(`.notranslate:contains(${key})`).text( translations[key] );
			});
		} else {
			const keys = Object.keys(translations);
			const values = Object.values(translations);
			
			values.forEach(function( value ) {
				const index = values.indexOf(value);
				$(`.notranslate:contains(${value})`).text( keys[index] );
			});
		}
	}

	function gt_get_lang() {
		var keyValue = document.cookie.match('(^|;) ?googtrans=([^;]*)(;|$)');
		return keyValue ? keyValue[2].split('/')[2] : gtHelper.defaultLanguage;	
	}
	
})(jQuery);
