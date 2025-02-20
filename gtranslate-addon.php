<?php
/*
Plugin Name: ELP GTranslate Addon
Description: Quick and dirty workaround for adding custom translations to GTranslate plugin. The Settings page appears in the Settings menu 
Version: 1.0
Author: ELP
License: GPL2
Text Domain: gtad
*/

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

class GTranslate_Addon {
	private $languages;
	private $default_language;
	
	function __construct() {
		$data = get_option('GTranslate');

		$this->default_language = $data['default_language'];
		$this->languages = array_diff( $data['fincl_langs'], [ $this->default_language ] );

		add_action( "wp_ajax_add_pair", array( $this, 'add_pair' ) );
		add_action( "wp_ajax_nopriv_add_pair", array( $this, 'add_pair' ) );
	}
	
	function add_pair() {
		$index = absint( $_REQUEST['index'] );
		echo $this->render_translation_pair( $index );
		wp_die();
	}
	
	function render_translation_pair( $index, 
									 $translation_pair = array(
										 'to_language' => '',
										 'from_word' => '',
										 'to_word' => '',										 
									 ) ) {
				
		$options = '';
		foreach ( $this->languages as $language ) {
			$selected = $translation_pair['to_language'] == $language ? 'selected' : '';
			
			$options .= "<option value='$language' $selected>$language</option>";
		}
				
		return "
				<div class='gtaddon-pair'>
					<div class='gtaddon-pair-options'>
						<label>" . __( 'From', 'gtad' ) . " ({$this->default_language})</label>
						<input name='gtaddon_translations[$index][from_word]' type='text' class='gtaddon-input' value='{$translation_pair['from_word']}' />
					</div>
					<div class='gtaddon-pair-options'>
						<label>" . __( 'To', 'gtad' ) . "</label>
						<select name='gtaddon_translations[$index][to_language]' class='gtaddon-select'>
							$options
						</select>
						<input name='gtaddon_translations[$index][to_word]' type='text' class='gtaddon-input' value='{$translation_pair['to_word']}' />
					</div>
					<div class='gtaddon-pair-options gtaddon-buttons'>
						<div class='gtaddon-pair-delete button'>" . __( 'Delete', 'gtad' ) . "</div>
					</div>
				</div>";
	}
	
	function admin_options_page() {
		$translation_pairs = get_option('gtaddon_translations');
// 		echo '<pre>' . print_r($translation_pairs, true) . '</pre>';
	?>
	<div>
		<?php screen_icon(); ?>
		<h1><?php _e( 'GTranslate Addon options', 'gtad' ) ?></h1>
		<h3><?php _e( 'Select the language and the translation for each word/phrase', 'gtad' ) ?></h3>
		<p>*<?php _e( 'The words and phrases to replace should be marked with class <strong>notranslate</strong>', 'gtad' ) ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'gtaddon_options_group' ); ?>
			<?php do_settings_sections( 'gtaddon_options_group' ); ?>
			
			<?php submit_button(); ?>
			<div class='gtaddon-pair-add button-primary'> <?php _e( 'Add translation pair', 'gtad' ) ?> </div>
			<div class='gtaddon-pairs-container'>
				<?php 
					foreach ( $translation_pairs as $index => $pair ) {
						echo $this->render_translation_pair( $index, $pair ); 
					}
				?>
			</div>
			
			<div class='gtaddon-pair-options gtaddon-buttons'>
				<div class='gtaddon-pair-add button-primary'><?php _e('Add translation pair', 'gtad') ?></div>
				<div class='spinner'></div>
			</div>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
	}

};

$GTAddon = new GTranslate_Addon;

add_action( 'wp_enqueue_scripts', function() {
	wp_enqueue_script( 'gtranslate-addon-js', plugin_dir_url( __FILE__ ) . '/public.js', array( 'jquery' ) );
    wp_localize_script( 'gtranslate-addon-js', 'gtHelper',
        array( 
			'translationPairs' => array_column( get_option('gtaddon_translations'), 'to_word', 'from_word' ),
        )
    );
} );

add_action( 'admin_enqueue_scripts', function() {
	wp_enqueue_script( 'gtranslate-addon-js', plugin_dir_url( __FILE__ ) . '/admin.js', array( 'jquery' ) );
	wp_localize_script( 'gtranslate-addon-js', 'gtadHelper', array( 
		'ajax_url' => admin_url( 'admin-ajax.php' ),
	) );

	wp_enqueue_style( 'gtranslate-addon-css', plugin_dir_url( __FILE__ ) . '/admin.css' );
} );

add_action( 'admin_init', function() {
	add_option( 'gtaddon_settings', 'GTranslate Addon settings' );
	register_setting( 'gtaddon_options_group', 'gtaddon_translations', array(
		'show_in_rest' => true,
		'type'         => 'text',
	) );
} );


add_action( 'admin_menu', function() {
	add_options_page( 'GTranslate Addon settings', 'GTranslate Addon', 'manage_options', 'gtaddon', 
					 array( new GTranslate_Addon, "admin_options_page" ) );
} );
