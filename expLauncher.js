/**
 * Main manager and creator of experimental design
 * 
 * @requires jsPsych
 * @param opts
 */
function ExpLauncher(opts, canvas){
	var module ={};
	
	/** @type {StimEngine} */
	var engine;
	
	
	/**
	 * Helper method implementing Fisher-Yates shuffle
	 * @param	{Array}	The array to shuffle
	 * @return	{Array}	The shuffled array
	 */
	function shuffle(array) {
	    for (var i = array.length - 1; i > 0; i--) {
	        var j = Math.floor(Math.random() * (i + 1));
	        var temp = array[i];
	        array[i] = array[j];
	        array[j] = temp;
	    }
	    return array;
	}
	
	
	/**
	 * Helper method to return all possible pairs in a set. includes pairs made of the same set repeated twice.
	 * Used to build similarity judgment trials. DOES NOT recognize or deal with repeat entries
	 * 
	 * @param {Array}	list	array of things from which to generate all possible types of pairs
	 */
	function getAllPairs(list){
		var combinations = [];
		list.forEach(function(elt, i, array) {
			//combinations.push([elt, elt]);
			for(var cur=0; cur<array.length; cur++){
				combinations.push([elt, array[cur]]);
			}
		});
		return combinations;
	}
	
	function getDistancesArray(diff, attNumber){
		var distances = [];
		for(var j=0; j+diff<=attNumber; j++){
			distances.push(j);
		}
		return distances;
	}
	
	//gets browser info, god knows how this works...
	function get_browser_info(){
	    var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
	    if(/trident/i.test(M[1])){
	        tem=/\brv[ :]+(\d+)/g.exec(ua) || []; 
	        return {name:'IE',version:(tem[1]||'')};
	        }   
	    if(M[1]==='Chrome'){
	        tem=ua.match(/\bOPR\/(\d+)/)
	        if(tem!=null)   {return {name:'Opera', version:tem[1]};}
	        }   
	    M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
	    if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
	    return {
	      name: M[0],
	      version: M[1]
	    };
	 }
	
	
	module.loadMicroComponents = function(settings, callback){
		var count = 0
		var done = (Object.keys(settings.microcomponents).length+Object.keys(settings.practice_components).length) * 2;
		
		function check(){
			if(count == done){
				engine  = StimEngine(opts, canvas);
				callback(settings);
			}
		}
		function load(){
			count++;
			check();
		}
		
		function makeImg(str){
			var mc = new Image();
			mc.onload = load;
			mc.src = str;
			return mc;
		}
		
		function cyclePairs(components){
			for(var pair in components){
				if(components.hasOwnProperty(pair)){
					var pair = components[pair];
					for(var attr in pair){
						if(pair.hasOwnProperty(attr)){
							pair[attr] = makeImg(pair[attr]);
						}
					}
				}
			}
		}
		cyclePairs(settings.microcomponents);
		cyclePairs(settings.practice_components);
	}
	
	/**
	 * Returns a list of objects containing the all the possible trials made by combining two images among the category names in 'names' and each available distance
	 * Each object is meant to represent a similarity judgment trial. A trials comprises two stimuli, each of a particular category among 'names' plus a vectorial distance among 'distances'
	 * this function will return an array of 'length' trials, with each subtype roughly uniformly represented (each trial object will be multiplied to exceed 'length', then the whole array will be truncated to match 'length' but after randomization)
	 * 
	 * @param	{Object}	options				Parameters for this function stuffed into a neat object :)
	 * @param	{Array}		options.names		An array of all category names you wish to use for the experiment
	 * @param	{Array}		options.distances	An array of all allowed distances between pairs
	 * @param	{Function}	options.distTweak	A function that will each generated trial and be able to modify it dynamically as you need.
	 * @param	{Number}	options.length		The number of trial (and pairs)	you wish to create for your similarity block
	 * 
	 */
	module.createRawSimilarityTimeline = function(options){	
		var pairs = getAllPairs(options.names);
		var typesOfTrials = pairs.length * options.distances.length;
		var multiplier = Math.floor(options.length/typesOfTrials) + 1;
		var rawTimeline = jsPsych.randomization.factorial({'pairLabel': pairs, 'distance': options.distances}, multiplier, false);
		
		rawTimeline.forEach(function(elt, i, array) {
			var extraData = {};
			extraData.firstStim = elt.pairLabel[0];
			extraData.secondStim = elt.pairLabel[1];
			extraData.kind = extraData.firstStim == extraData.secondStim ? 'same' : 'different';
			extraData.distance = elt.distance;
			elt.data = extraData;
		});
		return rawTimeline.slice(0, options.length);
	}
	
	/**
	 * takes a raw similarity timeline as returned by {@link ExpLauncher#createRawSimilarityTimeline}, your vectorial definitions of stimulus invariants, and return
	 * A jsPsych timeline of similarity trials but not quite with real images, but a full vectorial definition for each stimuli ready to be created via a call to {@link stimEngine#}
	 * 
	 * @param	{function}	distFnc	Function that receives the distance of the trial and converts it as you wish, useful to calibrate distances to only some values
	 */
	module.createVectorialSimilarityTimeline = function(rawTimeline, definitions, distFnc){
		var timeline=[];
		rawTimeline.forEach(function(rawTrial, i, array) {
			//first some sanity checks
			if(!(definitions.hasOwnProperty(rawTrial.pairLabel[0]) && definitions.hasOwnProperty(rawTrial.pairLabel[1]))){
				throw "seems you are not using the same category names used when creating the rawTrial argument";
			}
			var trial = {type:'similarity'};
			var vectors = engine.generateVectorPair({
				firstType: definitions[rawTrial.pairLabel[0]],
				secondType: definitions[rawTrial.pairLabel[1]],
				distance: (typeof distFnc == 'undefined') ? rawTrial.data.distance : distFnc(rawTrial.data.distance)
			})
			trial.stimuli = vectors;
			trial.data = rawTrial.data;
			trial.hardware_first_stim = {recipient:"native", payload:20};
			trial.hardware_second_stim = {recipient:"native", payload:21};
			timeline.push(trial);
		});
		return timeline;
	};
	
	
	/**
	 * Given a jsPsych timeline where stimuli are actually vectorial representations instead of images, this function finds them, calls the engine rendering function and replaces the
	 * vectors with the actual images as Data URIs.
	 * @method
	 * @param	{Object[]}	vectorTimeline	An array of objects like that returned by {@link ExpLauncher#createVectorialTimeline}. must have a 'stimuli' property containing a vectorial def or an array of vectorial defs
	 * @param	{Function}	callback		a function to be called after every call to the engine rendering function. provided with two positional arguments: the index of the trial being currently processed, and the total number of trials to be processed.	
	 */
	module.replaceVectorsWithImage = function(vectorTimeline, promise, components, density){
		if(components){
			engine.setComponents(components);
		}
		// I think this is where we should batch up our canvas draws so that it is non blocking
		
		vectorTimeline.forEach(function(raw, i, array) {
			var multiple = raw.stimuli.length == undefined ? false : true;
			if(!multiple){
				raw.stimulus = engine.singleDraw(raw.stimulus);
				
			}
			else{
				raw.stimuli[0] = engine.singleDraw(raw.stimuli[0], components, density);
				raw.stimuli[1] = engine.singleDraw(raw.stimuli[1], components, density);
			}
			if(promise) promise.notify();
		});
	};
	
	/**
	 * Creates a raw timeline of jsPsych categorization trials from a previously created raw similarity trials.If the demanded length
	 * is larger than the total number of stimuli in the given similarity timeline, stimuli will be repeated roughly uniformly until the total
	 * length matchesthe 'length' argument.
	 * 
	 * @param	{Array}						simTimeline	An array of trial-objects as returned by a call to {@link expLauncher#replaceVectorsWithImage} or alternatively to {@link expLauncher#getVectorialSimilarityTimeline} if you don't want actual stimuli in the trials but only vectorial representations
	 * @param	{Object<String, number>}	answers		A dictionnary assigning a keycode to a category name, one per allowed response.The category names used when creating the 'simTimeline' must be defined in this argument.
	 * @param	{Integer}					length		How many trials long should the resulting timeline be.
	 * @return	{Object[]}								An array of objects looking like jsPsych trials, but with names instead of actual stimuli					
	 */
	module.getCategorizationTimelineFromSim = function(simTimeline, answers, length){
		var timeline = [];
		simTimeline.forEach(function(trial, i, array) {
			var first = {type: 'categorize'};
			var second = {type: 'categorize'};
			first.stimulus = trial.stimuli[0];
			first.data = {category: trial.data.firstStim};
			first.key_answer = answers[first.data.category];
			timeline.push(first);
			
			second.stimulus = trial.stimuli[1];
			second.data = {category: trial.data.secondStim};
			second.key_answer = answers[second.data.category];
			timeline.push(second);
		});
		if(length > timeline.length){
			var fulltimeline = timeline.slice(0);
			//we need to multiply the current timeline to match the length;
			
			var multiplier = Math.floor(length / timeline.length) + 1;
			for(var i=0;i<multiplier;i++){
				timeline = timeline.concat(fulltimeline);
			}
		}
		shuffle(timeline);
		timeline = timeline.slice(0, length);
		return timeline;
	}
	
	
	/**
	 * Creates definition objects, setting a number of their attributes to mutually exclusive values.
	 * 
	 * @param	{integer}	n		The number of categories to create. This implicitly defines the number of values a single attribute can take( if you ask for 4 categories, then each attribute must be able to assume 4 different values if these categories are to be orthogonal)
	 * @param	{integer}	size	The number of attributes each category definition will contain. This means all categories returned will have the same size and the same attribute numbers e.g. 0 through 'size'. You cannot for example have one category that does not have attribute 2 when the other has it.
	 * @param	{integer}	diff	how many of the above number of attributes must be set to values that are guaranteed to be different across the definitions. These attributes are chosen at random. The possible values are 0 through 'n'. For example if attribute number 3 is among the 'diff' attributes chosen to be different, then each category definition will have a different value at index '3'.
	 * @public
	 * @method
	 * 
	 * @return	{Array<Object>}		An array of size 'n', each entry being a category definition.
	 */
	module.createOrthogonalDefs = function(n, size, diff){
		if(diff > size){
			throw "the requested difficulty was higher than the degrees of freedom";
		}
		var definitions = [];
		var values = [];
		var attributes = [];

		for(var i=0; i<n; i++){
			var def={};
			for(var j=0; j<size; j++){
				def[j] = 'free';
				if(i==0){
					attributes.push(j); // only add to the attributes the first time around! almost missed that one...
				}
			}
			definitions.push(def);
			values.push(i);
		}
		var chosen = jsPsych.randomization.sample(attributes, diff, false);
		chosen.forEach(function(attToSet, idx, ar){
			shuffle(values);
			values.forEach(function(elt, i, array) {
				definitions[i][attToSet] = elt;
			});
		});
		return definitions;
	}
	
	
	function insertPauses(timeline, howMany, url, check_fn){
		if(howMany <= 0 ){
			return;
		}
		
		var beforeLength = timeline.length;
		
		var pauseTrial = {
			type: 'html',
			url: '/webexp/'+serverPsych.getLabel()+'/request/snippet/'+url,
			cont_btn: 'ctn-button',
			check_fn: check_fn
		}
		
		if(howMany>timeline.length){
			throw "you want more pauses than trials??? wtf"
		}
		else{
			timeline.push(pauseTrial);
			howMany--;
			if(howMany > 0){
				var interval = Math.floor(timeline.length/(howMany+1));
				// now actually proceed to insert
				for(cursor=interval; cursor<beforeLength; cursor += interval+1){
					timeline.splice(cursor, 0, pauseTrial);
				}
			}
			
		}
	}
	
	
	/**
	 * The settings object returned by our server. This list of properties is non-exhaustive and more can appear, but those are the required ones.
	 * @typedef		{Object}	ServerSetting	A dictionnary read from a JSON string returned by a call to our server requesting a description of the experiment to run
	 * @property	{Integer}	levels			If set, this is the number of difficulty levels from which we should choose at random when creating an experiment, starting from the easiest difficulty. E.g. if levels is 2 and there are 5 microcomponents pairs, then this module will randomly create experiments where either 5/5 or 4/5 microcomponents are invariant. If levels = 4, then it would choose among 5/5, 4/5, 3/5, 2/5. If 0, all possibilities will be considered.
	 * @property	{Object}	microcomponents	A dictionary with number-in-string as keys, and microcomponent pair as values. Each pair is itself an object, with a "string containing a number" as keys, and a path as value. 
	 * @property	{Object<String, Integer>}	categories		The names and keycodes of the categories will we use.
	 * @property	{Array}		timeline		An array of {@link ServerBlock}s, used to tell the client how we want the experiment built.
	 */
	
	/**
	 * A dictionary, returned by our django server, describing a block within the timeline. it's settings are meant to be applied to all trials within.
	 * Together, these blocks create the timeline property of a {@link ServerSetting}
	 * @typedef		{Object}	ServerBlock	
	 * @property	{String}	type		The kind of trial this block is/contains. It is the value of the 'type' parameter of a jsPsych trial. see: http://docs.jspsych.org/plugins/overview/
	 * @property	{Integer}	reprise		The index inside a {@link ServerSetting.timeline} of the block that is meant to be identically repeated here. If defined, do not define any other attribute.
	 */
	
	
	
	
	function chooseDiff(attNumber, levels){
		//TODO: remove this temporary change
		return 2;
		
		
		if(levels > attNumber){
			throw "requested more possible difficulties than there are attribute pairs";
		}
		var diffPool = [];
		for(var d=attNumber; d>=(attNumber - levels); d--){
			diffPool.push(d); //zero-index fix, ugh...
		}
		return diffPool[Math.floor(Math.random()*diffPool.length)]; //among the possible difficulties, take one at random
	}
	
	/**
	 * @typedef StimuliWrapper
	 * @type Object
	 * @property {Object}	components	Each entry in this object represents holds the mc pairs and the url to the microcomponent
	 * @property {Array}	definitions	Vectorial description of the invariants as returned by {@link expLauncher#createOrthogonalDefs}
	 * @property {Integer}	difficulty	The difficulty level that has been chosen for these stimuli.
	 */
	
	
	/**
	 * Creates the array of image pairs from the settings passed at creation time.
	 * images are created with the engine provided and given as dataURIs. Use them to give stimuli to your jsPsych trials.
	 * Each call will give different images each time, so beware.
	 * 
	 * @param	{object}	options				parameters for the functions
	 * @param	{Number}	options.diff		difficulty if you need it to be set
	 * @param 	{boolean} 	options.practice	If true, uses the "practice_components" instead of the "microcomponents" attribute of the setting object.
	 * @returns {StimuliWrapper}		
	 */
	module.makeStimDescription = function makeStimDescription(options){
		practice = options.practice || false;
	
		var components = options.practice ? opts.practice_components : opts.microcomponents;
		var attNumber = Object.keys(components).length;
		var numberOfCat = Object.keys(opts.categories).length;
		
		var diff = (typeof options.diff == 'undefined') ? chooseDiff(attNumber, opts.levels) : options.diff;
		var defs = module.createOrthogonalDefs(numberOfCat, Object.keys(components).length, diff);
		var definitions ={};
		Object.keys(opts.categories).forEach(function(elt, idx){
			definitions[elt] = defs[idx];
		});
		
		return {
			components: components,
			definitions: definitions,
			difficulty: diff
		};
	};
	
	
	/**
	 * Final step before creating an actual array of images.
	 * @param	{Object}			options				the main options object
	 * @param	{Number}			options.length		how many pairs you wish to create.		
	 * @param	{StimuliWrapper}	options.wrapper		Description of the chosen MCs and the invariants.
	 * @param	{Number}			options.density		The stimuli density.
	 * @param	{Function}			options.distTweak	A function to dynamically change the generated distance in the pairs, receives the trial as single param
	 * @param	{function}			options.atEach		function that will be called after each pair is drawn and saved. useful to update a progress bar.
	 * @returns	{Array[]}								Array of img DOM element pairs.
	 */
	module.makeStimuli = function makeStimuli(options){
		
		var attNumber = Object.keys(options.wrapper.components).length;
		var distances = (typeof options.distances == 'undefined') ? getDistancesArray(options.wrapper.difficulty, attNumber) : options.distances;
		
		var rawTimeline = module.createRawSimilarityTimeline({
			distTweak: options.distTweak,
			names:[Object.keys(options.wrapper.definitions)[0], Object.keys(options.wrapper.definitions)[1]],
			distances : distances,
			length : options.length
		})
		
		var vectorTimeline = module.createVectorialSimilarityTimeline(rawTimeline, options.wrapper.definitions, options.distTweak);
		vectorTimeline.forEach(function(elt, i, array) {
			if(elt.data.kind ==="same"){
				elt.data.distance = elt.data.distance;
			}
			else if(elt.data.kind === "different"){
				elt.data.distance = elt.data.distance + options.wrapper.difficulty;
			}
			else throw "unsupported similarity kind, neither same or different?";
		});
		
		module.replaceVectorsWithImage(vectorTimeline, options.atEach, options.components, options.density);
		return vectorTimeline;
	};
	
	
	/**
	 * Main method, creates a fully usable jsPsych timeline according to the given settings, creating stimuli on-the-fly from micro-components with my awesome {@link stimEngine} object
	 * @method
	 * @param	{Object}			options				Parameter object
	 * @param	{Object}			options.description	If set, the demanded parameters. will be chosen for you otherwise
	 * @param	{boolean}			options.reuseStim		true if you wish to use the same stimuli for both categorizatio and similiraty
	 * @param	{Function}			options.atEach			What to do once the timeline and stimuli are fully created
	 * @param	{ServerSetting}		options.settings		The raw settings object fetched from the Django server. Should contain an entry named 'timeline' that is almost like a jsPsych timeline.
	 * @param	{Function}			options.distTweak		A function that allows arbitrary modifications to each generated similarity trial just before stimuli are generated. receives the trial as single parameter. Use to set distances to arbiratry conditions.
	 * @return	{Object	}							An object with two properties: 'timeline', a fully working jsPsych timeline ready to use with jsPsych.init, and 'meta', containing information about things decided/discovered client-side that you might want to save to your server
	 */
	module.createStandardExperiment = function(options){
		
		var stimWrap;
		//check if a description was already provided, if so skip description generation and use the one provided
		if(options.description){
			stimWrap = options.description
		}
		else{
			stimWrap = module.makeStimDescription({
				practice: false
			});
		}
		
		var practiceStimWrap = module.makeStimDescription({practice:true});
		var timeline =[];
		
		var meta = {};
		
		var stimuli = module.makeStimuli({
			wrapper: stimWrap,
			length: options.settings.length,
			atEach: options.atEach,
			distTweak: options.distTweak
		});
		
		var practiceStimuli = module.makeStimuli({
			wrapper: practiceStimWrap,
			length: options.settings.practices,
			atEach: options.atEach,
			components : options.settings.practice_components,
			density: 10
		});
		
		// ok so now we should have all we need to create stuff, lets iterate through the given timeline
		for(var step=0; step< options.settings.timeline.length; step++){
			var block = options.settings.timeline[step];
			block.return_stim = false;
			//Let's start with an easy case: a reprise of a previous block
			if(block.reprise != undefined){
				timeline.push(timeline[block.reprise]);
			}
			else if(block.type === 'html'){
				var tablestring = createSampleTable(5, 5, stimuli)[0].outerHTML;
				var block = {
					type: 'single-stim',
					is_html: true,
					stimulus: tablestring,
					prompt: block.message
				};
			}
			else if(block.type == 'similarity'){
				//TODO handle cases where block could be a trial to use as is, or an actual bloc where we have to simply repeat or generate
				//for now let's assume all ServerBlocks will ask us to generate a series of trials that are not all identical
				block.timeline = block.is_practice ? practiceStimuli : stimuli;
			}
			else if(block.type == 'categorize'){
				//I moved the key codes to the main object because i needed the names of the categories there to build them, pull them back here
				var choices = [];
				for(var key in options.settings.categories){
					if(options.settings.categories.hasOwnProperty(key)){
						choices.push(options.settings.categories[key]);
					}
				}
				block.choices = choices;
				if(block.is_practice){
					block.timeline = module.getCategorizationTimelineFromSim(practiceStimuli, options.settings.categories, options.settings.practices);
				}
				else{
					block.timeline = module.getCategorizationTimelineFromSim(stimuli, options.settings.categories, block.length);
					insertPauses(block.timeline, options.settings.number_of_pauses, 'questionnaire.html', collectQuestionnaire);
				}
			}
			timeline.push(block);
		}
		
		//TODO: make this less cringe-worthy
		//Add the stimuli sample page by hand here, make it pretty later
		var sampleBlock = {
				type: 'text',
				text: "<p> Here is an example of the textures you will use</p>"+createSampleTable(3, 3, stimuli)[0].outerHTML
		};
		
		timeline.splice(1, 0, sampleBlock);
		
		
		//We should end by adding some stuff to the meta object here
		meta.subject = options.settings.subject;
		//meta.previous = options.settings.previous;
		meta.complete = true;
		meta.exp_id = options.settings.exp_id;
		meta.current_exp = options.settings.current_exp;
		meta.toSave = stimWrap;
		return {meta: meta, timeline: timeline};
		
		
		
		
	}
	
	function collectQuestionnaire(jsPsychTarget, inputDict){
		return inputDict;
	}
	
	//Stims is an array of objects, with only one member: stimuli, an array of two images
	function createSampleTable(rows, cols, stims){
		var imageNb = rows*cols;
		var exploded = [];
		
		for(var i=0;i<stims.length; i++){
			exploded.push(stims[i].stimuli[0]);
			exploded.push(stims[i].stimuli[1]);
		}
		
		exploded = jsPsych.randomization.sample(exploded, imageNb, false);
		var images = [];
		exploded.forEach(function(imgstr){
			var img = new Image();
			img.src = imgstr;
			images.push(img);
		});
		
		var $table = $("<table>", {'class':'stim-table'});
		for(var i=0; i< rows; i++){
			var $row = $("<tr>");
			for(var j=0; j< cols;j++){
				var $td = $("<td>");
				$td.append(images.pop());
				$row.append($td);
			}
			$table.append($row);
		}
		return $table;
	}
	
	/**
	 * Allows you to set the {@link StimEngine} object used to create the stimuli
	 * 
	 * @param	{StimEngine}	newEngine	The new {@link StimEngine} that will be used when calling some of this objects methods
	 */
	module.setEngine = function(newEngine){
		engine = newEngine;
	}
	
	return module;
}