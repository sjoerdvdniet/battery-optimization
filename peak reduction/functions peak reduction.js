var PowerUp, // battery power for charging; float [0,->
	PowerDown, // battery power for discharging; float [0,->
	Capacity, // battery capacity; float > 0
	Margin = .01, // error margin to determine if task is fulfilled; float <0,1>
	QuitFit = 25, // maximum depth of recursion in fitBattery(); integer <0,->
	QuitBase = 25, // maximum depth of recursion in findBaseline(); integer <0,->
	TheCurve = []; // the load curve; array of floats


function fitBattery( task, solution, q ){
	// fit battery to the task, analysis starts here
	// task is divided into subtasks
	// if subtask is resolved, then it is added to the solution
	// else it is submitted to analysis itself, hence recursion
	// a task is defined as: [ start time index, end time index, initial battery state, battery end state, baseline, (un)resolved ]
	// respectively: integer, integer, float [0-Capacity], float [0-Capacity], float, boolean
	// power when charging is defined as positive, power when discharging as negative
	// the solution is an array of resolved subtasks, it is empty when first calling this function
	// q is meant to keep count of the depth of recursion

	if( solution.length > 0 ) t[2] = solution[ solution.length -1 ][3]; // reset initial battery state to equal the exact battery end state of last subtask

	var curve = theCurve.slice( task[0], task[1]+1 ), // relevant section of TheCurve
		floor = Math.min.apply( Math, curve ), // min value of curve
		peak = Math.max.apply( Math, curve ) - floor, // distance between min and max values of curve
		base = floor, // set base initially to min value of curve
		newTasks; // array of subtasks

	if( task[2] < task[3] ) base += peak; //  if the task is to charge (not to discharge), then set base initially to max value of curve
	base = findBaseline( task, peak, base, 0 ); // determine base
	newTasks = sliceTask( task, base ); // slice task into subtasks given the determined base

	for( t of newTasks ){ // loop through subtasks
	 	if( t[5] || q == QuitFit ) solution.push( t ); // if subtask is resolved or if we want to terminate the recursion anyway, then submit subtask to solution
	 	else solution = fitBattery( t, solution, q+1 ); // else submit subtask to analysis, i.e. recursion
	}

	return solution;

}


function findBaseline( task, peak, base, q ){
	// find baseline, i.e. level below which battery will charge and above which battery will discharge
	// the baseline is recursively adjusted, step size is halved each time, initial step size is equal to peak
	// disregarding battery capacity

	var up = 0,	// cumulative charging, >= 0
		down = 0, // cumulative discharging, >= 0
		newBase = 'n', // new base, initially set to 'n'
		d = task[3] - task[2], // differential to be covered by the task
		c, // value of the curve
		e; // error, as fraction of d

	for( i = task[0]; i<task[1]+1; i++ ){ // loop through relevant section of TheCurve
		c = TheCurve[i]; // update c
		down += Math.max( 0, Math.min( PowerDown, c - base ) ); // discharge by amount above base, capped by PowerDown
		up += Math.max( 0, Math.min( PowerUp, base -  c ) ); // or charge by amount below base, capped by PowerUp
	}
	
	if( d == 0 ){
		d = Capacity * Margin**2; // alternative d to prevent that the error will be Infinity
		if( task[2] + d >= Capacity ) d *= -1; // if the task is to go from full capacity to full capacity, then d should be negative to ensure it doesn't end up beyond capacity
	}

	e = ( up - down - d ) / d; // error, i.e. how close the base leads to fulfilling the task; in order to stay within capacity, it has to be negative

	if( ( e > 0 || -e > Margin ) && q < QuitBase ){ // if e is positive or beyond Margin, and if we don't want to terminate the recursion yet, then determine new base
		if( peak == 0 ){ // if the task has duration of one time unit, then peak is 0 and the adjustment will not be successful
			if( d < 0 ) peak = PowerDown; // and peak is set to PowerUp or PowerDown instead
			else peak = PowerUp;
		}
		if( up-down < d ) newBase = base + peak * (1/2)**q; // set base higher
		if( up-down > d ) newBase = base - peak * (1/2)**q; // set base lower
		if( newBase != 'n' ) base = findBaseline( task, peak, newBase, q+1 ); // recursion so as to get more precise baseline
	}

	return base;

}


function sliceTask( task, base ){
	// slice task into subtasks, a subtask being a continuous stretch of either charging or discharging
	// here it is checked if the battery stays within capacity
	// if not, the subtask is marked as unresolved

	var p = 0, // power
		prev, // previous power
		s0, // previous s2
		s1 = task[2], // battery state w/o correction for capacity
		s2 = task[2], // battery state w/ correction for capacity
		t = [ task[0], 0, s2, 0, base, true ], // subtask
		newTasks = [], // array of subtasks
		c, // value of the curve
		withinCapacity = true, // indicator if s1 has gone beyond capacity
		k = 0; // keeps count of number of subtasks

	for( i = task[0]; i < task[1]+1; i++ ){ // loop through relevant section of TheCurve
		
		c = TheCurve[i]; // update c
		prev = p; // update prev
		if( c > base ) p = -Math.max( 0, Math.min( PowerDown, c - base ); // update p
		if( c < base ) p = Math.max( 0, Math.min( PowerUp, base - c ) );
		
		s0 = s2; // update s0

		if( p * prev < 0 ){ // if direction changes, then wrap up open subtask and open new one (this part is a bit tedious)
			if( !withinCapacity ){ // if capacity has been exceeded in subtask, then some corrections will be required
				if( k == 0 && s2 == t[2] ) prev = 0; // in case the battery starts at zero or full capacity and the first subtask is pushing it down or up respectively, i.e. out of capacity, then set prev to zero, subtask will subsequently be marked as resolved
				if( k > 0 && newTasks[ k-1 ][5] ){ // if previous subtask (if any) was marked as resolved, then it is merged with the current subtask
					t = newTasks.pop(); // re-open previous subtask
					k--; // update k accordingly
				}
				if( prev != 0 ) t[5] = false; // mark subtask as unresolved
			}
			t[1] = i - 1; // set end time of subtask
			t[3] = s0; // set battery end state of subtask
			newTasks.push( t ); // submit subtask
			t = [ i, 0, s0, 0, base, true ]; // new subTask
			withinCapacity = true; // reset withinCapacity
			s1 = s2; // reset s1
			k++; // update k
		}

		s1 += p; // update s1
		s2 = Math.max( 0, Math.min( Capacity, s1 ) ); // update s2, i.e. s1 corrected for battery capacity
		if( s1 != s2 ) withinCapacity = false; // update withinCapacity

	}

	if( !withinCapacity || Math.abs( s2 - task[3] ) > Capacity * Margin ) t[5] = false; // mark final subtask as unresolved
	t[1] = task[1]; // set end time of final subtask
	t[3] = task[3]; // set battery end state of final subtask
	newTasks.push( t ); // submit final subtask

	return newTasks;

}