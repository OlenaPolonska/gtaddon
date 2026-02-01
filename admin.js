/**
 * GTranslate Addon - Admin JavaScript
 * 
 * Handles dynamic translation pair management in the admin interface
 * 
 * @package GTranslateAddon
 * @version 2.0
 */

(function($){
	"use strict";

	/**
     * Translation Pair Manager
     * 
     * Manages the addition, deletion, and validation of translation pairs
     */
	const GTAddon = {

		config: {
			pairSelector: '.gtaddon-pair',
			addButtonSelector: '.gtaddon-pair-add',
			deleteButtonSelector: '.gtaddon-pair-delete',
			inputSelector: 'input[type="text"]',
			selectSelector: 'select',
			
			pairElement: $('.gtaddon-pair'),
			containerElement: $('.gtaddon-pairs-container'),
			addButtonElement: $('.gtaddon-pair-add'),
			spinnerElement: $('.gtaddon-buttons .spinner'),
		},

        state: {
            isLoading: false,
            isDirty: false
        },

        init: function() {
            if (typeof gtAddonHelper === 'undefined') {
                console.error('GTAddon: Helper object not loaded');
                return;
            }

            if (!gtAddonHelper.ajax_url || !gtAddonHelper.nonce) {
                console.error('GTAddon: Missing required configuration');
                return;
            }

            this.bindEvents();
            this.updateIndices();
            this.initializeAccessibility();
        },

        bindEvents: function() {
            const self = this;

            $(document).on('click', this.config.addButtonSelector, function(e) {
                e.preventDefault();
                self.addPair();
            });

            $(document).on('click', this.config.deleteButtonSelector, function(e) {
                e.preventDefault();
                self.deletePair($(this));
            });

            $(document).on('change', this.config.pairSelector + ' input, ' + this.config.pairSelector + ' select', function() {
                self.state.isDirty = true;
            });

            $(window).on('beforeunload', function() {
                if (self.state.isDirty) {
                    return 'You have unsaved changes. Are you sure you want to leave?';
                }
            });

            $('form').on('submit', function(e) {
                if (!self.validateForm()) {
                    e.preventDefault();
                    return false;
                }
            });
        },

        /**
         * Add a new translation pair via AJAX
         */
        addPair: function() {
            if (this.state.isLoading) {
                return;
            }

            const $button = this.config.addButtonElement.first();
            const $spinner = this.config.spinnerElement;
            const nextIndex = this.config.pairElement.length;

            this.setLoadingState(true, $button, $spinner);

            $.ajax({
                url: gtAddonHelper.ajax_url,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'ajax_add_pair',
                    nonce: gtAddonHelper.nonce,
                    index: nextIndex
                },
                success: (response) => {
                    this.handleAddPairSuccess(response);
                },
                error: (xhr, status, error) => {
                    this.handleAddPairError(xhr, status, error);
                },
                complete: () => {
                    this.setLoadingState(false, $button, $spinner);
                }
            });
        },

        /**
         * Handle successful pair addition
         * 
         * @param {Object} response AJAX response object
         */
        handleAddPairSuccess: function(response) {
            if (response.success && response.data && response.data.html) {
                this.config.containerElement.append(response.data.html);
                this.updateIndices();

				const $newPair = this.config.pairElement.last();
                $newPair.find(this.config.inputSelector).first().focus();
                
                this.scrollToElement($newPair);
                
                this.state.isDirty = true;
            } else {
                const errorMessage = response.data && response.data.message 
                    ? response.data.message 
                    : 'Failed to add translation pair. Please try again.';
                
                console.error('GTAddon: Server returned error:', response);
            }
        },

        /**
         * Handle pair addition error
         * 
         * @param {Object} xhr XMLHttpRequest object
         * @param {string} status Status text
         * @param {string} error Error message
         */
        handleAddPairError: function(xhr, status, error) {
            console.error('GTAddon AJAX Error:', {
                status: status,
                error: error,
                response: xhr.responseText
            });
        },

        /**
         * Delete a translation pair with confirmation
         * 
         * @param {jQuery} $button The delete button that was clicked
         */
        deletePair: function($button) {
            const $pair = $button.closest(this.config.pairSelector);
            const pairCount = this.config.pairElement.length;
            
            const sourceText = $pair.find(this.config.inputSelector).first().val() || 'this pair';
            
            const confirmMessage = pairCount === 1
                ? 'Are you sure you want to clear this translation pair?'
                : 'Are you sure you want to delete the translation for "' + sourceText + '"?';
            
            if (!confirm(confirmMessage)) {
                return;
            }

            if (pairCount === 1) {
                this.clearPair($pair);
            } else {
                this.removePair($pair);
            }
            
            this.state.isDirty = true;
        },

        /**
         * Clear a translation pair's inputs
         * 
         * @param {jQuery} $pair The pair element to clear
         */
        clearPair: function($pair) {
            $pair.find(this.config.inputSelector).val('');
            $pair.find(this.config.selectSelector).prop('selectedIndex', 0);
            
            $pair.find(this.config.inputSelector).first().focus();
            
            console.log('GTAddon: Translation pair cleared');
        },

        /**
         * Remove a translation pair
         * 
         * @param {jQuery} $pair The pair element to remove
         */
        removePair: function($pair) {
            const $nextPair = $pair.next(this.config.pairSelector);
            const $prevPair = $pair.prev(this.config.pairSelector);
            
            $pair.fadeOut(300, () => {
                $pair.remove();
                this.updateIndices();
                
                if ($nextPair.length) {
                    $nextPair.find(this.config.inputSelector).first().focus();
                } else if ($prevPair.length) {
                    $prevPair.find(this.config.inputSelector).first().focus();
                }
            });
        },

        /**
         * Update input name attributes to maintain sequential indices
         */
        updateIndices: function() {
            this.config.pairElement.each((index, element) => {
                const $pair = $(element);
                
                $pair.find('input, select').each(function() {
                    const $input = $(this);
                    const name = $input.attr('name');
                    
                    if (name) {
                        const newName = name.replace(/\[\d+\]/, '[' + index + ']');
                        $input.attr('name', newName);
                    }
                });

                this.updateAccessibilityAttributes($pair, index);
            });
        },

        /**
         * Update accessibility attributes (IDs and labels)
         * 
         * @param {jQuery} $pair The pair element
         * @param {number} index The index of the pair
         */
        updateAccessibilityAttributes: function($pair, index) {
            const $inputs = $pair.find(this.config.inputSelector);
            const $select = $pair.find(this.config.selectSelector);
            const $labels = $pair.find('label');

            if ($inputs.length >= 1) {
                const fromId = 'gtaddon-from-' + index;
                $inputs.eq(0).attr('id', fromId);
                if ($labels.length >= 1) {
                    $labels.eq(0).attr('for', fromId);
                }
            }

            if ($select.length) {
                const langId = 'gtaddon-to-lang-' + index;
                $select.attr('id', langId);
                if ($labels.length >= 2) {
                    $labels.eq(1).attr('for', langId);
                }
            }

            if ($inputs.length >= 2) {
                const toId = 'gtaddon-to-word-' + index;
                $inputs.eq(1).attr('id', toId);
                if ($labels.length >= 3) {
                    $labels.eq(2).attr('for', toId);
                }
            }
        },

        /**
         * Initialize accessibility features
         */
        initializeAccessibility: function() {
            this.config.containerElement.attr({
                'role': 'region',
                'aria-label': 'Translation pairs'
            });

            this.config.addButtonElement.attr({
                'aria-label': 'Add new translation pair'
            });
        },

        /**
         * Validate the form before submission
         * 
         * @return {boolean} True if form is valid
         */
        validateForm: function() {
            let isValid = true;
            const errors = [];
            let errorCount = 0;

            this.config.pairElement.removeClass('gtaddon-error');

            this.config.pairElement.each((index, element) => {
                const $pair = $(element);
                const $inputs = $pair.find(this.config.inputSelector);
                const $select = $pair.find(this.config.selectSelector);

                const fromWord = $inputs.eq(0).val().trim();
                const toLanguage = $select.val();
                const toWord = $inputs.eq(1).val().trim();

                const hasAnyValue = fromWord || toLanguage || toWord;

                if (hasAnyValue) {
                    const hasAllValues = fromWord && toLanguage && toWord;
                    
                    if (!hasAllValues) {
                        isValid = false;
                        errorCount++;
                        $pair.addClass('gtaddon-error');
                        
                        const missingFields = [];
                        if (!fromWord) missingFields.push('source text');
                        if (!toLanguage) missingFields.push('language');
                        if (!toWord) missingFields.push('translation');
                        
                        errors.push('Pair ' + (index + 1) + ': Missing ' + missingFields.join(', '));
                    }
                }
            });

            if (!isValid) {
                const errorMessage = 'Please fix the following errors:\n\n' + errors.join('\n');
                console.log(errorMessage);
                
                const $firstError = $(this.config.pairSelector + '.gtaddon-error').first();
                if ($firstError.length) {
                    this.scrollToElement($firstError);
                    $firstError.find(this.config.inputSelector).first().focus();
                }
            }

            return isValid;
        },

        /**
         * Set loading state for UI elements
         * 
         * @param {boolean} loading Whether loading is active
         * @param {jQuery} $button Button element
         * @param {jQuery} $spinner Spinner element
         */
        setLoadingState: function(loading, $button, $spinner) {
            this.state.isLoading = loading;
            
            if (loading) {
                $button.prop('disabled', true).addClass('disabled');
                $spinner.addClass('is-active');
            } else {
                $button.prop('disabled', false).removeClass('disabled');
                $spinner.removeClass('is-active');
            }
        },

        /**
         * Scroll to an element smoothly
         * 
         * @param {jQuery} $element Element to scroll to
         */
        scrollToElement: function($element) {
            if (!$element.length) return;
            
            const elementTop = $element.offset().top;
            const elementBottom = elementTop + $element.outerHeight();
            const viewportTop = $(window).scrollTop();
            const viewportBottom = viewportTop + $(window).height();
            
            if (elementTop < viewportTop || elementBottom > viewportBottom) {
                $('html, body').animate({
                    scrollTop: elementTop - 100 // 100px offset from top
                }, 300);
            }
        }
    };

    $(document).ready(function() {
        GTAddon.init();
    });

    window.GTAddon = GTAddon;

})(jQuery);
