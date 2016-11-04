




     function runExperiment(){
    	 djPsych.request(function(params){
    		 jsPsych.init({
    			 timeline : params.timeline,
    			 on_finish : function(data){
    				 djPsych.save(data, false);
    			 }
    		 });
    		 
    	 });   	     	 
    	 
     };