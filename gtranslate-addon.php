<?php
/**
 * Plugin Name: ELP GTranslate Addon
 * Description: Quick and dirty workaround for adding custom translations to GTranslate plugin. 
 * The Settings page appears in the Settings menu 
 * Version: 2.0
 * Author: ELP
 * License: GPL2
 * Text Domain: gtad
 * Requires at least: 5.8
 * Requires PHP: 7.4
 *
 * @package GTranslateAddon
 */

namespace GTranslateAddon;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( __NAMESPACE__ . '\PLUGIN_VERSION', '2.0' );
define( __NAMESPACE__ . '\PLUGIN_FILE', __FILE__ );
define( __NAMESPACE__ . '\PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( __NAMESPACE__ . '\PLUGIN_URL', plugin_dir_url( __FILE__ ) );

const GTR_OPTIONS_KEY 		  	= 'GTranslate';
const GTR_ADDON_OPTIONS_KEY   	= 'gtaddon_translations';
const GTR_ADDON_CACHE_GROUP 	= 'gtr_addon_csche_group';
const GTR_LANGUAGES_CACHE_KEY 	= 'gtr_languages_cache_key';
const GTR_ADDON_CACHE_KEY 		= 'gtr_addon_cache_key';
const GTR_ADDON_PAIRS_CACHE_KEY = 'gtr_addon_cache_key';
const GTR_ADDON_SCRIPT_KEY 		= 'gtranslate-addon-js';
const GTR_ADDON_HELPER_KEY 		= 'gtAddonHelper';
const GTR_ADDON_OPTIONS_GROUP   = 'gtaddon_options_group';
const GTR_ADDON_NONCE_ACTION    = 'gtaddon_add_pair';
const GTR_ADDON_NONCE_NAME      = 'gtaddon_nonce';

/**
 * Initialize plugin hooks
 */
add_action( 'plugins_loaded', __NAMESPACE__ . '\\init' );
function init() {
	add_action( 'admin_init', __NAMESPACE__ . '\\register_admin_page' );
	add_action( 'admin_menu', __NAMESPACE__ . '\\register_in_menu' );
	add_action( 'admin_enqueue_scripts', __NAMESPACE__ . '\\admin_enqueue_scripts' );
	
	add_action( 'wp_enqueue_scripts', __NAMESPACE__ . '\\frontend_enqueue_scripts' );
	
	add_action( 'update_option_' . GTR_ADDON_OPTIONS_KEY, __NAMESPACE__ . '\\clear_caches', 10, 2 );
	add_action( 'update_option_' . GTR_OPTIONS_KEY, __NAMESPACE__ . '\\clear_caches', 10, 2 );
	
	add_action( 'wp_ajax_ajax_add_pair', __NAMESPACE__ . '\\ajax_add_pair' );
}

/**
 * Get available languages from GTranslate configuration
 *
 * @return array{other: array<string>, default: string}
 */
function get_languages(): array {
	$cached = wp_cache_get( GTR_LANGUAGES_CACHE_KEY, GTR_ADDON_CACHE_GROUP );
	if ( false !== $cached && is_array( $cached ) ) {
		return $cached;
	}
	
	$options = get_option( GTR_OPTIONS_KEY, [] );
	if ( ! is_array( $options ) ) {
		$options = [];
	}
	
	$default_language = sanitize_text_field( $options['default_language'] ?? 'en' ); 
	
	$all_languages = $options['fincl_langs'] ?? [];
	if ( ! is_array( $options ) ) {
		$all_languages = [];
	}
	
	$other_languages 	 = array_diff( $all_languages, [$default_language] );
	$sanitized_languages = array_values( array_map( 'sanitize_text_field', $other_languages ) );
	
	$languages = [
		'other'   => $sanitized_languages,
		'default' => $default_language,
	];
	
	wp_cache_set( GTR_LANGUAGES_CACHE_KEY, $languages, GTR_ADDON_CACHE_GROUP, DAY_IN_SECONDS );	
	return $languages;
}

/**
 * Get sanitized addon options
 *
 * @return array<array{from_word: string, to_language: string, to_word: string}>
 */
function get_addon_options(): array {
	$cached = wp_cache_get( GTR_ADDON_CACHE_KEY, GTR_ADDON_CACHE_GROUP );
	if ( false !== $cached && is_array( $cached ) ) {
		return $cached;
	}
	
	$options = get_option( GTR_ADDON_OPTIONS_KEY, [] );
	if ( ! is_array( $options ) ) {
		$options = array();
	}

	$sanitized_options = sanitize_addon_options( $options );
	wp_cache_set( GTR_ADDON_CACHE_KEY, $sanitized_options, GTR_ADDON_CACHE_GROUP, DAY_IN_SECONDS );
	
	return $sanitized_options;
}

/**
 * Sanitize addon options array
 *
 * @param array $options Raw options array
 * @return array<array{from_word: string, to_language: string, to_word: string}>
 */
function sanitize_addon_options( array $options ): array {
	$sanitized = [];
	
	foreach ( $options as $pair ) {
		if ( ! is_array( $pair ) ) {
			continue;
		}

		$from_word 	 = sanitize_text_field( $pair['from_word'] ?? '' );
		$to_language = sanitize_text_field( $pair['to_language'] ?? '' );
		$to_word 	 = sanitize_text_field( $pair['to_word'] ?? '' );

		if ( ! empty($from_word) && ! empty($to_language) && ! empty($to_word) ) {
			$sanitized[] = [
				'from_word'   => $from_word,
				'to_language' => $to_language,
				'to_word' 	  => $to_word,
			];
		}
	}
	return $sanitized;
}

/**
 * Get translation pairs indexed by language and source word
 *
 * @return array<string, array<string, string>>
 */
function get_translation_pairs(): array {
	$cached = wp_cache_get( GTR_ADDON_PAIRS_CACHE_KEY, GTR_ADDON_CACHE_GROUP );
	if ( false !== $cached && is_array( $cached ) ) {
		return $cached;
	}
	
	$pairs = array_column( get_addon_options(), 'to_word', 'from_word' );
	
	wp_cache_set( GTR_ADDON_PAIRS_CACHE_KEY, $pairs, GTR_ADDON_CACHE_GROUP, DAY_IN_SECONDS );
	
	return $pairs;
}

/**
 * Clear all plugin caches
 */
function clear_caches(): void {
	wp_cache_delete( GTR_LANGUAGES_CACHE_KEY, GTR_ADDON_CACHE_GROUP );
	wp_cache_delete( GTR_ADDON_CACHE_KEY, GTR_ADDON_CACHE_GROUP );
	wp_cache_delete( GTR_ADDON_PAIRS_CACHE_KEY, GTR_ADDON_CACHE_GROUP );
}

/**
 * Enqueue frontend scripts and styles
 */
function frontend_enqueue_scripts(): void {
	if ( ! file_exists( PLUGIN_DIR . 'public.js' ) ) {
		return;
	}
	
	wp_enqueue_script( GTR_ADDON_SCRIPT_KEY, PLUGIN_URL . '/public.js', ['jquery'], PLUGIN_VERSION, true );
	
	$languages = get_languages();
	$pairs 	   = get_translation_pairs();

	wp_localize_script( GTR_ADDON_SCRIPT_KEY, GTR_ADDON_HELPER_KEY, [
			'translationPairs' => $pairs,
			'defaultLanguage'  => $languages['default'] ?? 'en',
		] 
    );
}

/**
 * Enqueue admin scripts and styles
 *
 * @param string $hook Current admin page hook
 */
function admin_enqueue_scripts( string $hook ): void {
	if ( 'settings_page_gtaddon' !== $hook ) {
		return;
	}
	
	if ( file_exists( PLUGIN_DIR . 'admin.js' ) ) {
		wp_enqueue_script( GTR_ADDON_SCRIPT_KEY, PLUGIN_URL . '/admin.js', ['jquery'], PLUGIN_VERSION, true );
		wp_localize_script( 
			GTR_ADDON_SCRIPT_KEY, 
			GTR_ADDON_HELPER_KEY, [
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( GTR_ADDON_NONCE_ACTION ),
		] );
	}

	if ( file_exists( PLUGIN_DIR . 'admin.css' ) ) {
		wp_enqueue_style( 'gtranslate-addon-css', PLUGIN_URL . '/admin.css', [], PLUGIN_VERSION );
	}
}

/**
 * Register plugin settings
 */
function register_admin_page() {
	add_option( 'gtaddon_settings', esc_html__('GTranslate Addon settings', 'gtad') );
	register_setting( 
		GTR_ADDON_OPTIONS_GROUP, 
		GTR_ADDON_OPTIONS_KEY, 
		[
			'type'              => 'array',
			'sanitize_callback' => __NAMESPACE__ . '\sanitize_addon_options',
			'default'           => [],
		] );
}

/**
 * Register plugin in admin menu
 */
function register_in_menu(): void {
	add_options_page( 
		esc_html__('GTranslate Addon settings', 'gtad'), 
		esc_html__('GTranslate Addon', 'gtad'), 
		'manage_options', 
		'gtaddon', 
		__NAMESPACE__ . '\\render_admin_page' );
}

/**
 * Render admin settings page
 */
function render_admin_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'gtad' ) );
	}
	
	$translation_pairs = get_addon_options();
	ob_start();
?>
<div>
	<?php screen_icon(); ?>
	
	<h1><?php echo esc_html( get_admin_page_title() ) ?></h1>
	<h3><?php esc_html_e( 'Select the language and the translation for each word/phrase', 'gtad' ) ?></h3>
	
	<div class="notice notice-info">
		<p>
			<?php 
				printf(
					esc_html__('Words and phrases to replace should be marked with the CSS class %s', 'gtad'),
					'<code>notranslate</code>'
				);
			?>
		</p>
	</div>
	
	<form method="post" action="options.php">
		<?php settings_fields( GTR_ADDON_OPTIONS_GROUP ); ?>
		<?php do_settings_sections( GTR_ADDON_OPTIONS_GROUP ); ?>

		<?php submit_button(); ?>
		<div class='gtaddon-pair-add button-primary'> <?php esc_html_e( 'Add translation pair', 'gtad' ) ?> </div>
		<div class='gtaddon-pairs-container'>
			<?php 
				if ( empty( $translation_pairs ) ) {
					echo render_translation_pair();
				} else {
					foreach ( $translation_pairs as $index => $pair ) {
						echo render_translation_pair($index, $pair);
					}
				}
			?>
		</div>

		<div class='gtaddon-pair-options gtaddon-buttons'>
			<button class='gtaddon-pair-add button-primary'>
				<?php esc_html_e('Add translation pair', 'gtad') ?>
			</button>
			<div class='spinner'></div>
		</div>
		<?php submit_button(); ?>
	</form>
</div>
<?php
	echo ob_get_clean();
}

function render_translation_pair( int $index = 0, array $translation_pair = [] ): string {
	static $all_languages = false;
	if ( false === $all_languages ) {
		$all_languages = get_languages();
	}
		
	$defaults = array(
		'from_word'   => '',
		'to_language' => '',
		'to_word'     => '',
	);
	$translation_pair = array_map( 'esc_attr', wp_parse_args( $translation_pair, $defaults ) );	
	$option_name_base = GTR_ADDON_OPTIONS_KEY . '[' . absint( $index ) . ']';
		
	ob_start();
	?>
	<div class="gtaddon-pair">
		<div class="gtaddon-pair-options">
			<label for="gtaddon-from-<?php echo absint( $index ); ?>">
				<?php
				printf(
					esc_html__( 'From (%s)', 'gtad' ),
					esc_html( $all_languages['default'] )
				);
				?>
			</label>
			<input 
				type="text" 
				id="gtaddon-from-<?php echo absint( $index ); ?>"
				name="<?php echo esc_attr( $option_name_base . '[from_word]' ); ?>" 
				class="gtaddon-input regular-text" 
				value="<?php echo $translation_pair['from_word']; ?>"
				placeholder="<?php esc_attr_e( 'Enter source text', 'gtad' ); ?>"
			/>
		</div>
		
		<div class="gtaddon-pair-options">
			<label for="gtaddon-to-lang-<?php echo absint( $index ); ?>">
				<?php esc_html_e( 'To Language', 'gtad' ); ?>
			</label>
			<select 
				id="gtaddon-to-lang-<?php echo absint( $index ); ?>"
				name="<?php echo esc_attr( $option_name_base . '[to_language]' ); ?>" 
				class="gtaddon-select"
			>
				<option value=""><?php esc_html_e( 'Select language', 'gtad' ); ?></option>
				<?php foreach ( $all_languages['other'] as $lang_code ) : ?>
					<option 
						value="<?php echo esc_attr( $lang_code ); ?>"
						<?php selected( $translation_pair['to_language'], $lang_code ); ?>
					>
						<?php echo esc_html( $lang_code ); ?>
					</option>
				<?php endforeach; ?>
			</select>
		</div>
		
		<div class="gtaddon-pair-options">
			<label for="gtaddon-to-word-<?php echo absint( $index ); ?>">
				<?php esc_html_e( 'Translation', 'gtad' ); ?>
			</label>
			<input 
				type="text" 
				id="gtaddon-to-word-<?php echo absint( $index ); ?>"
				name="<?php echo esc_attr( $option_name_base . '[to_word]' ); ?>" 
				class="gtaddon-input regular-text" 
				value="<?php echo $translation_pair['to_word']; ?>"
				placeholder="<?php esc_attr_e( 'Enter translation', 'gtad' ); ?>"
			/>
		</div>
		
		<div class="gtaddon-pair-options gtaddon-buttons">
			<button type="button" class="button gtaddon-pair-delete">
				<?php esc_html_e( 'Delete', 'gtad' ); ?>
			</button>
		</div>
	</div>
	<?php
	return ob_get_clean();
}

/**
 * AJAX handler for adding new translation pair
 */
function ajax_add_pair(): void {	
	check_ajax_referer(GTR_ADDON_NONCE_ACTION, 'nonce');
	
	if ( ! current_user_can('manage_options') ) {
		wp_send_json_error( ['message' => esc_html__( 'Insufficient permissions', 'gtad' )] );
	}
	
	$index = absint( $_REQUEST['index'] ?? 0 );
	$html  = render_translation_pair($index);

	wp_send_json_success( ['html' => $html] );
	wp_die();
}

