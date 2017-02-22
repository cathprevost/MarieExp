
/**
 * 
 * @param settings
 * @returns
 */
function abx_run(settings){
	
	var launcher = ExpLauncher(settings, document.getElementById("stimCanvas")); //initialize a launcher and drawer 
	var $bar = $("#progressBar");
	var $progressLabel = $("<div></div>");
	$progressLabel.html(loading);
	$("#jsPsychTarget").append($progressLabel);
	
	$bar.progressbar({
		value :false
	});
	
	if(firstTime && settings.oldParams && settings.oldParams.components && settings.oldParams.components[0][0]){
		settings.microcomponents = settings.oldParams.components
	}
	
	launcher.loadMicroComponents(settings, function(){
		
		
		
		var exp = launcher.createStandardExperiment({
			settings: settings,
			description : firstTime ? false : settings.oldParams, //if not the first time, fetch the definitions from the oldParams!
			distances: [0,3]
		});
		
		$progressLabel.remove();
		exp.meta.startTime = new Date().toISOString();
		$bar.progressbar("destroy");
		
		$("#stimCanvas").remove();
		//HERE IS WHERE THE EXPERIMENT BEGINS
		// Test code to test for unexpected
		// jsPsych.data.addProperties({dummy: 'lol'}) yay my code works for arbitrary extra data!
		
		jsPsych.init({
			display_element: $("#jsPsychTarget"),
			timeline: exp.timeline,
			on_finish: function(data){
				var complete = serverPsych.count() < 2 ? false : true;
				//jsPsych.data.displayData("json");
				serverPsych.save({
					data:data,
					toSave:exp.meta.toSave,
					complete:complete
				});
			},
			on_trial_start:function(){
				$("#jsPsychTarget")[0].scrollIntoView();
			}
		})
	})
	
}