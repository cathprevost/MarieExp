
 function runExperiment(){
	 serverPsych.request(function(params){
		 jsPsych.init({
			 timeline : params.timeline,
			 on_finish : function(data){
				 serverPsych.save(data, false);
			 }
		 });
		 
	 });   	     	 
	 
 };