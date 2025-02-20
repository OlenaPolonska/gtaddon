(function($){
	"use strict";

	$(document).ready( function() {

		$('.gtaddon-pair-delete').on('click', function() {
			$(this).closest('.gtaddon-pair').remove();
		});
	
		$('.gtaddon-pair-add').on('click', function() {
			let self = $(this);
			let ajax_spinner = self.parent().find('.spinner').css('visibility', 'visible');

			$.ajax({
				type: 'GET',
				url: gtadHelper.ajax_url,
				data: { 
					action: 'add_pair',
					index: $('.gtaddon-pair').length,
				},
				success: function( result ){
// 					console.log( result );
					ajax_spinner.css('visibility', 'hidden');
					if ( typeof result === "undefined" ) return false;
					
					$('.gtaddon-pairs-container').append( result );
					return false;
				},
				error: function (request, status, error) {
					console.log(request, status, error);
					return false;
				}
			});
		});
	});

})(jQuery);
