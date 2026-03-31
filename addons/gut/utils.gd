@tool
class_name GutUtils
extends Object

const GUT_METADATA = '__gutdbl'

# Note, these cannot change since places are checking for TYPE_INT to determine
# how to process parameters.
enum DOUBLE_STRATEGY{
	INCLUDE_NATIVE,
	SCRIPT_ONLY,
}

enum DIFF {
	DEEP,
	SIMPLE
}

const TEST_STATUSES = {
	NO_ASSERTS = 'no asserts',
	SKIPPED = 'skipped',
	NOT_RUN = 'not run',
	PENDING = 'pending',
	# These two got the "ed" b/c pass is a reserved word and I could not
	# think of better words.
	FAILED = 'fail',
	PASSED = 'pass'
}

const DOUBLE_TEMPLATES = {
	FUNCTION = 'res://addons/gut/double_templates/function_template.txt',
	INIT = 'res://addons/gut/double_templates/init_template.txt',
	SCRIPT = 'res://addons/gut/double_templates/script_template.txt',
}

const NOTHING := '__NOTHING__'
const NO_TEST := 'NONE'
const GUT_ERROR_TYPE = 999

enum TREAT_AS {
	NOTHING,
	FAILURE,
}


## This dictionary defaults to all the native classes that we cannot call new
## on.  It is further populated during a run so that we only have to create
## a new instance once to get the class name string.
static var gdscript_native_class_names_by_type = {
	Tween:"Tween"
}


static var GutScene : PackedScene :
	get: return load('res://addons/gut/GutScene.tscn')
	set(val): pass

static var LazyLoader:
	get: return load('res://addons/gut/lazy_loader.gd')
	set(val): pass

static var VersionNumbers:
	get: return load("res://addons/gut/version_numbers.gd")
	set(val): pass

static var WarningsManager:
	get: return load("res://addons/gut/warnings_manager.gd")
	set(val): pass

static var EditorGlobals:
	get: return load("res://addons/gut/gui/editor_globals.gd")
	set(val): pass

static var RunExternallyScene : PackedScene :
	get: return load("res://addons/gut/gui/RunExternally.tscn")
	set(val): pass

# --------------------------------
# Lazy loaded scripts.  These scripts are lazy loaded so that they can be
# declared, but will not load when this script is loaded.  This gives us a
# window at the start of a run to adjust warning levels prior to loading
# everything.
# --------------------------------
static var _AutoFree = null
static var AutoFree:
	get:
		if(_AutoFree == null):
			_AutoFree = LazyLoader.new('res://addons/gut/autofree.gd')
		return _AutoFree.get_loaded()
	set(val): pass

static var _Awaiter = null
static var Awaiter:
	get:
		if(_Awaiter == null):
			_Awaiter = LazyLoader.new('res://addons/gut/awaiter.gd')
		return _Awaiter.get_loaded()
	set(val): pass

static var _Comparator = null
static var Comparator:
	get:
		if(_Comparator == null):
			_Comparator = LazyLoader.new('res://addons/gut/comparator.gd')
		return _Comparator.get_loaded()
	set(val): pass

static var _CollectedTest = null
static var CollectedTest:
	get:
		if(_CollectedTest == null):
			_CollectedTest = LazyLoader.new('res://addons/gut/collected_test.gd')
		return _CollectedTest.get_loaded()
	set(val): pass

static var _CollectedScript = null
static var CollectedScript:
	get:
		if(_CollectedScript == null):
			_CollectedScript = LazyLoader.new('res://addons/gut/collected_script.gd')
		return _CollectedScript.get_loaded()
	set(val): pass

static var _CompareResult = null
static var CompareResult:
	get:
		if(_CompareResult == null):
			_CompareResult = LazyLoader.new('res://addons/gut/compare_result.gd')
		return _CompareResult.get_loaded()
	set(val): pass

static var _DiffFormatter = null
static var DiffFormatter:
	get:
		if(_DiffFormatter == null):
			_DiffFormatter = LazyLoader.new("res://addons/gut/diff_formatter.gd")
		return _DiffFormatter.get_loaded()
	set(val): pass

static var _DiffTool = null
static var DiffTool:
	get:
		if(_DiffTool == null):
			_DiffTool = LazyLoader.new('res://addons/gut/diff_tool.gd')
		return _DiffTool.get_loaded()
	set(val): pass

static var _DoubleTools = null
static var DoubleTools:
	get:
		if(_DoubleTools == null):
			_DoubleTools = LazyLoader.new("res://addons/gut/double_tools.gd")
		return _DoubleTools.get_loaded()
	set(val): pass

static var _Doubler = null
static var Doubler:
	get:
		if(_Doubler == null):
			_Doubler = LazyLoader.new('res://addons/gut/doubler.gd')
		return _Doubler.get_loaded()
	set(val): pass

static var _DynamicGdScript = null
static var DynamicGdScript:
	get:
		if(_DynamicGdScript == null):
			_DynamicGdScript = LazyLoader.new("res://addons/gut/dynamic_gdscript.gd")
		return _DynamicGdScript.get_loaded()
	set(val): pass

static var _Gut = null
static var Gut:
	get:
		if(_Gut == null):
			_Gut = LazyLoader.new('res://addons/gut/gut.gd')
		return _Gut.get_loaded()
	set(val): pass

static var _GutConfig = null
static var GutConfig:
	get:
		if(_GutConfig == null):
			_GutConfig = LazyLoader.new('res://addons/gut/gut_config.gd')
		return _GutConfig.get_loaded()
	set(val): pass

static var _GutFonts = null
static var GutFonts:
	get:
		if(_GutFonts == null):
			_GutFonts = LazyLoader.new("res://addons/gut/gut_fonts.gd")
		return _GutFonts.get_loaded()
	set(val): pass

static var _HookScript = null
static var HookScript:
	get:
		if(_HookScript == null):
			_HookScript = LazyLoader.new('res://addons/gut/hook_script.gd')
		return _HookScript.get_loaded()
	set(val): pass

static var _InnerClassRegistry = null
static var InnerClassRegistry:
	get:
		if(_InnerClassRegistry == null):
			_InnerClassRegistry = LazyLoader.new('res://addons/gut/inner_class_registry.gd')
		return _InnerClassRegistry.get_loaded()
	set(val): pass

static var _InputFactory = null
static var InputFactory:
	get:
		if(_InputFactory == null):
			_InputFactory = LazyLoader.new("res://addons/gut/input_factory.gd")
		return _InputFactory.get_loaded()
	set(val): pass

static var _InputSender = null
static var InputSender:
	get:
		if(_InputSender == null):
			_InputSender = LazyLoader.new("res://addons/gut/input_sender.gd")
		return _InputSender.get_loaded()
	set(val): pass

static var _JunitXmlExport = null
static var JunitXmlExport:
	get:
		if(_JunitXmlExport == null):
			_JunitXmlExport = LazyLoader.new('res://addons/gut/junit_xml_export.gd')
		return _JunitXmlExport.get_loaded()
	set(val): pass

static var _LoggerLoader = null
static var GutLogger:
	get:
		if(_LoggerLoader == null):
			_LoggerLoader = LazyLoader.new('res://addons/gut/logger.gd')
		return _LoggerLoader.get_loaded()
	set(val): pass

static var _MethodMaker = null
static var MethodMaker:
	get:
		if(_MethodMaker == null):
			_MethodMaker = LazyLoader.new('res://addons/gut/method_maker.gd')
		return _MethodMaker.get_loaded()
	set(val): pass

static var _OneToMany = null
static var OneToMany:
	get:
		if(_OneToMany == null):
			_OneToMany = LazyLoader.new('res://addons/gut/one_to_many.gd')
		return _OneToMany.get_loaded()
	set(val): pass

static var _OptionMaker = null
static var OptionMaker:
	get:
		if(_OptionMaker == null):
			_OptionMaker = LazyLoader.new('res://addons/gut/gui/option_maker.gd')
		return _OptionMaker.get_loaded()
	set(val): pass

static var _OrphanCounter = null
static var OrphanCounter:
	get:
		if(_OrphanCounter == null):
			_OrphanCounter = LazyLoader.new('res://addons/gut/orphan_counter.gd')
		return _OrphanCounter.get_loaded()
	set(val): pass

static var _ParameterFactory = null
static var ParameterFactory:
	get:
		if(_ParameterFactory == null):
			_ParameterFactory = LazyLoader.new('res://addons/gut/parameter_factory.gd')
		return _ParameterFactory.get_loaded()
	set(val): pass

static var _ParameterHandler = null
static var ParameterHandler:
	get:
		if(_ParameterHandler == null):
			_ParameterHandler = LazyLoader.new('res://addons/gut/parameter_handler.gd')
		return _ParameterHandler.get_loaded()
	set(val): pass

static var _PrintersLoader = null
static var Printers:
	get:
		if(_PrintersLoader == null):
			_PrintersLoader = LazyLoader.new('res://addons/gut/printers.gd')
		return _PrintersLoader.get_loaded()
	set(val): pass

static var _ResultExporter = null
static var ResultExporter:
	get:
		if(_ResultExporter == null):
			_ResultExporter = LazyLoader.new('res://addons/gut/result_exporter.gd')
		return _ResultExporter.get_loaded()
	set(val): pass

static var _ScriptCollector = null
static var ScriptCollector:
	get:
		if(_ScriptCollector == null):
			_ScriptCollector = LazyLoader.new('res://addons/gut/script_parser.gd')
		return _ScriptCollector.get_loaded()
	set(val): pass

static var _SignalWatcher = null
static var SignalWatcher:
	get:
		if(_SignalWatcher == null):
			_SignalWatcher = LazyLoader.new('res://addons/gut/signal_watcher.gd')
		return _SignalWatcher.get_loaded()
	set(val): pass

static var _Spy = null
static var Spy:
	get:
		if(_Spy == null):
			_Spy = LazyLoader.new('res://addons/gut/spy.gd')
		return _Spy.get_loaded()
	set(val): pass

static var _Strutils = null
static var Strutils:
	get:
		if(_Strutils == null):
			_Strutils = LazyLoader.new('res://addons/gut/strutils.gd')
		return _Strutils.get_loaded()
	set(val): pass

static var _Stubber = null
static var Stubber:
	get:
		if(_Stubber == null):
			_Stubber = LazyLoader.new('res://addons/gut/stubber.gd')
		return _Stubber.get_loaded()
	set(val): pass

static var _StubParams = null
static var StubParams:
	get:
		if(_StubParams == null):
			_StubParams = LazyLoader.new('res://addons/gut/stub_params.gd')
		return _StubParams.get_loaded()
	set(val): pass

static var _Summary = null
static var Summary:
	get:
		if(_Summary == null):
			_Summary = LazyLoader.new('res://addons/gut/summary.gd')
		return _Summary.get_loaded()
	set(val): pass

static var _Test = null
static var Test:
	get:
		if(_Test == null):
			_Test = LazyLoader.new('res://addons/gut/test.gd')
		return _Test.get_loaded()
	set(val): pass

static var _TestCollector = null
static var TestCollector:
	get:
		if(_TestCollector == null):
			_TestCollector = LazyLoader.new('res://addons/gut/test_collector.gd')
		return _TestCollector.get_loaded()
	set(val): pass

static var _ThingCounter = null
static var ThingCounter:
	get:
		if(_ThingCounter == null):
			_ThingCounter = LazyLoader.new('res://addons/gut/thing_counter.gd')
		return _ThingCounter.get_loaded()
	set(val): pass
# --------------------------------

static var _gut_fonts = null
static var gut_fonts : Object :
	get:
		if(_gut_fonts == null):
			_gut_fonts = GutFonts.new()
		return _gut_fonts
	set(val): pass

static var _avail_fonts = null
static var avail_fonts : Array :
	get:
		if(_avail_fonts == null):
			_avail_fonts = gut_fonts.get_font_names()
		return _avail_fonts
	set(val): pass

static var _version_numbers = null
static var version_numbers : Object :
	get:
		if(_version_numbers == null):
			_version_numbers = VersionNumbers.new(
				# gut_versrion (source of truth)
				'9.5.0',
				# required_godot_version
				'4.5'
			)
		return _version_numbers
	set(val): pass


static var warnings_at_start := { # WarningsManager dictionary
	exclude_addons = true
}

static var warnings_when_loading_test_scripts := { # WarningsManager dictionary
	enable = false
}


# ------------------------------------------------------------------------------
# Everything should get a logger through this.
#
# When running in test mode this will always return a new logger so that errors
# are not caused by getting bad warn/error/etc counts.
# ------------------------------------------------------------------------------
static var _lgr = null
static func get_logger():
	if(_lgr == null):
		_lgr = GutLogger.new()
	return _lgr

static var _error_tracker = null
static func get_error_tracker():
	if(_error_tracker == null):
		_error_tracker = GutErrorTracker.new()
	return _error_tracker


static var _dyn_loader = null
static var _dyn_gdscript : Object :
	get:
		if(_dyn_loader == null):
			_dyn_loader = DynamicGdScript.new()
		return _dyn_loader
	set(val): pass
static func create_script_from_source(source, override_path=null):
	var are_warnings_enabled = WarningsManager.are_warnings_enabled()
	WarningsManager.enable_warnings(false)

	var DynamicScript = _dyn_gdscript.create_script_from_source(source, override_path)
	if(typeof(DynamicScript) == TYPE_INT):
		var l = get_logger()
		l.error(str('Could not create script from source.  Error:  ', DynamicScript))
		l.info(str("Source Code:\n", add_line_numbers(source)))

	WarningsManager.enable_warnings(are_warnings_enabled)

	return DynamicScript


# Get the EditorInterface instance without having to make a direct reference to
# it.  This allows for testing to be done on editor scripts that require it
# without having the parser error when you refer to it when not in the editor.
static func get_editor_interface():
	if(Engine.is_editor_hint()):
		var inst = load("res://addons/gut/get_editor_interface.gd").new()
		return inst.get_it()
	else:
		return null



static func godot_version_string():
	return version_numbers.make_godot_version_string()


static func is_godot_version(expected):
	return VersionNumbers.VerNumTools.is_godot_version_eq(expected)


static func is_godot_version_gte(expected):
	return VersionNumbers.VerNumTools.is_godot_version_gte(expected)


const INSTALL_OK_TEXT = 'Everything checks out'
static func make_install_check_text(template_paths=DOUBLE_TEMPLATES, ver_nums=version_numbers):
	var text = INSTALL_OK_TEXT
	if(!FileAccess.file_exists(template_paths.FUNCTION) or
		!FileAccess.file_exists(template_paths.INIT) or
		!FileAccess.file_exists(template_paths.SCRIPT)):

		text = 'One or more GUT template files are missing.  If this is an exported project, you must include *.txt files in the export to run GUT.  If it is not an exported project then reinstall GUT.'
	elif(!ver_nums.is_godot_version_valid()):
		text = ver_nums.get_bad_version_text()

	return text


static func is_install_valid(template_paths=DOUBLE_TEMPLATES, ver_nums=version_numbers):
	return make_install_check_text(template_paths, ver_nums) == INSTALL_OK_TEXT


# ------------------------------------------------------------------------------
# Gets the root node without having to be in the tree and pushing out an error
# if we don't have a main loop ready to go yet.
# ------------------------------------------------------------------------------
# static func get_root_node():
# 	var main_loop = Engine.get_main_loop()
# 	if(main_loop != null):
# 		return main_loop.root
# 	else:
# 		push_error('No Main Loop Yet')
# 		return null


# ------------------------------------------------------------------------------
# Gets the value from an enum.
# - If passed an integer value as a string it will convert it to an int and
# 	processes the int value.
# - If the value is a float then it is converted to an int and then processes
#	the int value
# - If the value is an int, or was converted to an int, then the enum is checked
#	to see if it contains the value, if so then the value is returned.
#	Otherwise the default is returned.
# - If the value is a string then it is uppercased and all spaces are replaced
#	with underscores.  It then checks to see if enum contains a key of that
#	name.  If so then the value for that key is returned, otherwise the default
#	is returned.
#
# This description is longer than the code, you should have just read the code
# and the tests.
# ------------------------------------------------------------------------------
static func get_enum_value(thing, e, default=null):
	var to_return = default

	if(typeof(thing) == TYPE_STRING and str(thing.to_int()) == thing):
		thing = thing.to_int()
	elif(typeof(thing) == TYPE_FLOAT):
		thing = int(thing)

	if(typeof(thing) == TYPE_STRING):
		var converted = thing.to_upper().replace(' ', '_')
		if(e.keys().has(converted)):
			to_return = e[converted]
	else:
		if(e.values().has(thing)):
			to_return = thing

	return to_return


# ------------------------------------------------------------------------------
# return if_null if value is null otherwise return value
# ------------------------------------------------------------------------------
static func nvl(value, if_null):
	if(value == null):
		return if_null
	else:
		return value


# ------------------------------------------------------------------------------
# ------------------------------------------------------------------------------
static func pretty_print(dict, indent = '  '):
	print(JSON.stringify(dict, indent))


# ------------------------------------------------------------------------------
# ------------------------------------------------------------------------------
static func print_properties(props, thing, print_all_meta=false):
	for i in range(props.size()):
		var prop_name = props[i].name
		var prop_value = thing.get(props[i].name)
		var print_value = str(prop_value)
		if(print_value.length() > 100):
			print_value = print_value.substr(0, 97) + '...'
		elif(print_value == ''):
			print_value = 'EMPTY'

		print(prop_name, ' = ', print_value)
		if(print_all_meta):
			print('  ', props[i])


static func print_method_list(thing):
	for entry in thing.get_method_list():
		print("* ", entry.name)


# ------------------------------------------------------------------------------
# Gets the value of the node_property 'script' from a PackedScene's root node.
# This does not assume the location of the root node in the PackedScene's node
# list.  This also does not assume the index of the 'script' node property in
# a nodes's property list.
# ------------------------------------------------------------------------------
static func get_scene_script_object(scene):
	var state = scene.get_state()
	var to_return = null
	var root_node_path = NodePath(".")
	var node_idx = 0

	while(node_idx < state.get_node_count() and to_return == null):
		if(state.get_node_path(node_idx) == root_node_path):
			for i in range(state.get_node_property_count(node_idx)):
				if(state.get_node_property_name(node_idx, i) == 'script'):
					to_return = state.get_node_property_value(node_idx, i)

		node_idx += 1

	return to_return


# ------------------------------------------------------------------------------
# returns true if the object has been freed, false if not
#
# From what i've read, the weakref approach should work.  It seems to work most
# of the time but sometimes it does not catch it.  The str comparison seems to
# fill in the gaps.  I've not seen any errors after adding that check.
# ------------------------------------------------------------------------------
static func is_freed(obj):
	var wr = weakref(obj)
	return !(wr.get_ref() and str(obj) != '<Freed Object>')


# ------------------------------------------------------------------------------
# Pretty self explanitory.
# ------------------------------------------------------------------------------
static func is_not_freed(obj):
	return !is_freed(obj)


# ------------------------------------------------------------------------------
# Checks if the passed in object is a GUT Double or Partial Double.
# ------------------------------------------------------------------------------
static func is_double(obj):
	var to_return = false
	if(typeof(obj) == TYPE_OBJECT and is_instance_valid(obj)):
		to_return = obj.has_method('__gutdbl_check_method__')
	return to_return


# ------------------------------------------------------------------------------
# Checks an object to see if it is a GDScriptNativeClass
# ------------------------------------------------------------------------------
static func is_native_class(thing):
	var it_is = false
	if(typeof(thing) == TYPE_OBJECT):
		it_is = str(thing).begins_with("<GDScriptNativeClass#")
	return it_is


# ------------------------------------------------------------------------------
# Checks if the passed in is an instance of a class
# ------------------------------------------------------------------------------
static func is_instance(obj):
	return typeof(obj) == TYPE_OBJECT and \
		!is_native_class(obj) and \
		!obj.has_method('new') and \
		!obj.has_method('instantiate')


# ------------------------------------------------------------------------------
# Checks if the passed in is a GDScript
# ------------------------------------------------------------------------------
static func is_gdscript(obj):
	return typeof(obj) == TYPE_OBJECT and str(obj).begins_with('<GDScript#')


# ------------------------------------------------------------------------------
# Checks if the passed in is an inner class
#
# Looks like the resource_path will be populated for gdscripts, and not populated
# for gdscripts inside a gdscript.
# ------------------------------------------------------------------------------
static func is_inner_class(obj):
	return is_gdscript(obj) and obj.resource_path == ''


# ------------------------------------------------------------------------------
# Returns an array of values by calling get(property) on each element in source
# ------------------------------------------------------------------------------
static func extract_property_from_array(source, property):
	var to_return = []
	for i in (source.size()):
		to_return.append(source[i].get(property))
	return to_return


# ------------------------------------------------------------------------------
# true if what is passed in is null or an empty string.
# ------------------------------------------------------------------------------
static func is_null_or_empty(text):
	return text == null or text == ''


# ------------------------------------------------------------------------------
# Get the name of a native class or null if the object passed in is not a
# native class.
# ------------------------------------------------------------------------------
static func get_native_class_name(thing):
	var to_return = null
	if(is_native_class(thing)):
		if(gdscript_native_class_names_by_type.has(thing)):
			to_return = gdscript_native_class_names_by_type[thing]
		else:
			var newone = thing.new()
			to_return = newone.get_class()
			if(!newone is RefCounted):
				newone.free()
			gdscript_native_class_names_by_type[thing] = to_return
	return to_return


# ------------------------------------------------------------------------------
# Write a file.
# ------------------------------------------------------------------------------
static func write_file(path, content):
	var f = FileAccess.open(path, FileAccess.WRITE)
	if(f != null):
		f.store_string(content)
	f = null;

	return FileAccess.get_open_error()


# ------------------------------------------------------------------------------
# Returns the text of a file or an empty string if the file could not be opened.
# ------------------------------------------------------------------------------
static func get_file_as_text(path):
	var to_return = ''
	var f = FileAccess.open(path, FileAccess.READ)
	if(f != null):
		to_return = f.get_as_text()
	else:
		var err = FileAccess.get_open_error()
		_lgr.error(str('Could not open file ', path, '.  Error ', err))
	f = null
	return to_return


# ------------------------------------------------------------------------------
# Loops through an array of things and calls a method or checks a property on
# each element until it finds the returned value.  -1 is returned if not found
# or the index is returned if found.
# ------------------------------------------------------------------------------
static func search_array_idx(ar, prop_method, value):
	var found = false
	var idx = 0

	while(idx < ar.size() and !found):
		var item = ar[idx]
		var prop = item.get(prop_method)
		if(!(prop is Callable)):
			if(item.get(prop_method) == value):
				found = true
		elif(prop != null):
			var called_val = prop.call()
			if(called_val == value):
				found = true

		if(!found):
			idx += 1

	if(found):
		return idx
	else:
		return -1


# ------------------------------------------------------------------------------
# Loops through an array of things and calls a method or checks a property on
# each element until it finds the returned value.  The item in the array is
# returned or null if it is not found (this method originally came first).
# ------------------------------------------------------------------------------
static func search_array(ar, prop_method, value):
	var idx = search_array_idx(ar, prop_method, value)

	if(idx != -1):
		return ar[idx]
	else:
		return null


static func are_datatypes_same(got, expected):
	return !(typeof(got) != typeof(expected) and got != null and expected != null)


static func get_script_text(obj):
	return obj.get_script().get_source_code()


# func get_singleton_by_name(name):
# 	var source = str("var singleton = ", name)
# 	var script = GDScript.new()
# 	script.set_source_code(source)
# 	script.reload()
# 	return script.new().singleton


static func dec2bistr(decimal_value, max_bits = 31):
	var binary_string = ""
	var temp
	var count = max_bits

	while(count >= 0):
		temp = decimal_value >> count
		if(temp & 1):
			binary_string = binary_string + "1"
		else:
			binary_string = binary_string + "0"
		count -= 1

	return binary_string


static func add_line_numbers(contents):
	if(contents == null):
		return ''

	var to_return = ""
	var lines = contents.split("\n")
	var line_num = 1
	for line in lines:
		var line_str = str(line_num).lpad(6, ' ')
		to_return += str(line_str, ' |', line, "\n")
		line_num += 1
	return to_return


static func get_display_size():
	return Engine.get_main_loop().get_viewport().get_visible_rect()



static func find_method_meta(methods, method_name):
	var meta = null
	var idx = 0
	while (idx < methods.size() and meta == null):
		var m = methods[idx]
		if(m.name == method_name):
			meta = m
		idx += 1

	return meta


static func get_method_meta(object, method_name):
	return find_method_meta(object.get_method_list(), method_name)

# ##############################################################################
#(G)odot (U)nit (T)est class
#
# ##############################################################################
# The MIT License (MIT)
# =====================
#
# Copyright (c) 2025 Tom "Butch" Wesley
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
#
# ##############################################################################
