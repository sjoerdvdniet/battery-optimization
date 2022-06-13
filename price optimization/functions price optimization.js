var PowerUp, // battery power for charging; float [0,->
	PowerDown, // battery power for discharging; float [0,->
	Capacity, // battery capacity; float <0,->
	DontMove = 1e-9, // minimum fluctuation for normal handling; float <0,->
	QuitFit = 25, // maximum depth of recursion; integer <0,->
	TheCurve = []; // the price curve; array of floats


function fitBattery( task, solution, q ){
	// analysis starts here
	// fit battery to the task
	// task will be divided into subtasks
	// if a subtask is resolved, then it is added to the solution
	// else it is submitted to analysis itself and divided into further subtasks, hence recursion
	// a task is defined as: [ start time index, end time index, initial battery state, battery end state, (dis)charge power, (un)resolved ]
	// respectively: integer, integer, float [0-Capacity], float [0-Capacity], float [-PowerDown, PowerUp], boolean
	// power when charging is defined as positive, power when discharging as negative
	// the solution is an array of resolved subtasks, it is empty when first calling this function
	// q is meant to keep count of the depth of recursion

	var base = findBaseline( task ); // determine level of baseline
	var newTasks = []; // array of subtasks
	var prev = 0; // latest power
	if( solution.length != 0 ) prev = solution[ solution.length-1 ][4]; // get latest power, going into this task;

	if( base == 'flat' ) newTasks = sliceFlat( task, prev ); // if curve is flat, then resolve task into subtasks with sliceFlat
	else newTasks = sliceTask( task, base ); // else resolve into subtasks with sliceTask

	for( t of newTasks ){ // loop through subtasks
		if( t[5] || q == QuitFit ) solution.push( t ); // if subtask is resolved or if we want to terminate the recursion anyway, then submit subtask to solution
		else solution = fitBattery( t, solution, q+1 ); // else submit subtask to analysis, i.e. recursion
	}

	return solution;

}


function findBaseline( task ){
	// find baseline, i.e. level below which battery will charge and above which battery will discharge
	// disregarding battery capacity

	var curve = TheCurve.slice( task[0], task[1]+1 ), // relevant slice of TheCurve
		m0 = Math.min.apply( Math, curve ), // min value of curve
		m1 = Math.max.apply( Math, curve ), // max value of curve
		d = task[3]-task[2], // differential to be covered during task
		l0 = task[1]-task[0]+1, // length i.e. duration of task
		l1 = ( d + l0*PowerDown ) / ( PowerUp + PowerDown ), // divide length in charging and discharging such that task is fulfilled, l1 is length of charging
		base; // level of baseline

	if( l1 <= 0 ) base = m0 - 1; // full power discharge all the time, so base below min value of curve
	else if( l1 >= l0 ) base = m1 + 1; // full power charge all the time, so base above max value of curve
	else if( m1 - m0 < DontMove ) base = 'flat'; // curve is considered flat
	else{ // else base should be in between min and max of curve (this is a bit tedious)
		curve.sort( function(a,b){ return a-b; } ); // sort curve from min to max
		if( l1 <= 1 ) l1 = 1; // if charge time or discharge time is less than one time unit, then raise it to one time unit (necessarily safe; zero will not lead to resolution, and time fractions are not in the game)
		if( l1 >= l0-1 ) l1 = l0-1; // if discharge time is less than one time unit, then raise it to one time unit, e.g. if l0 equals 10, l1 will now be in the range [ 1, 10 ]
		if( Math.floor(l1) == Math.ceil(l1) ) l1 += .1; // if l1 is an integer, then raise it a little, e.g. l1 will now be in the range [ 1.1, 9.1 ]
		base = ( curve[ Math.floor(l1)-1 ] + curve[ Math.floor(l1) ] )/2; // set base to average of two consecutive values in the sorted curve around l1, e.g. the 0th an 1st, up to the 8th and 9th
	}

	return base;

}


function sliceTask( task, base ){
	// slice task into subtasks, a subtask being a continuous stretch of either charging or discharging
	// here it is checked whether the battery stays within capacity
	// if not, the subtask is marked as unresolved

	var p = 0, // power
		prev, // previous power
		s0, // previous s2
		s1 = task[2], // battery state w/o correction for capacity
		s2 = task[2], // battery state w/ correction for capacity
		t = [ task[0], 0, s2, 0, 0, true ], // subtask
		newTasks = [], // array of subtasks
		c, // value of the curve
		withinCapacity = true, // indicator if s1 has gone beyond capacity
		k = 0, // keeps count of number of subtasks
		f; // end time of first subtask

	for( i = task[0]; i < task[1]+1; i++ ){ // loop through relevant section of TheCurve
		
		c = TheCurve[i]; // update c
		prev = p; // update prev
		if( c > base ) p = -PowerDown; // update p
		if( c < base ) p = PowerUp;
		
		s0 = s2; // update s0

		if( p * prev < 0 ){ // if direction changes, then wrap up open subtask and open new one (this is a bit tedious)
			if( !withinCapacity ){ // if capacity has been exceeded in subtask, then some corrections are needed
				if( k == 0 && s2 == t[2] ) prev = 0; // in case the battery starts at zero or full capacity and the first subtask is pushing it down or up respectively, i.e. out of capacity, then set prev to zero, subtask willl subsequently be marked as resolved
				if( k > 0 && newTasks[ k-1 ][5] ){ // if previous subtask (if any) was marked as resolved, then it is merged with the current subtask
					t = newTasks.pop(); // re-open previous subtask
					k--; // update k accordingly
				}
				if( prev != 0 ) t[5] = false; // mark subtask as unresolved
			}
			t[1] = i - 1; // set end time of subtask
			t[3] = s0; // set battery end state of subtask
			t[4] = prev; // set power during subtask
			newTasks.push( t ); // submit subtask
			t = [ i, 0, s0, 0, 0, true ]; // open new subtask
			withinCapacity = true; // reset withinCapacity
			s1 = s2; // reset s1
			k++; // update k
		}

		s1 += p; // update s1
		s2 = Math.max( 0, Math.min( Capacity, s1 ) ); // update s2, i.e. s1 corrected for battery capacity
		if( s1 != s2 ) withinCapacity = false; // update withinCapacity

	}

	if( s1 != task[3] ) t[5] = false; // if final subtask didn't end up at desired end state, then mark as unresolved
	t[1] = task[1]; // set end time of final subtask
	t[3] = task[3]; // set battery end state of final subtask
	t[4] = p; // set power during final subtask
	newTasks.push( t ); // submit final subtask
	
	f = newTasks[0][1]; // determine f
	newTasks = correctLast( task, newTasks );
	if( newTasks[0][1] == task[1] && !newTasks[0][5] && f > task[0] ) newTasks = sliceAlt( task, base ); // if newTasks consist of one subtask equal to the task while not being resolved, and if the first subtask had been longer than one time unit, then try sliceAlt
	if( newTasks[0][1] == task[1] && !newTasks[0][5] ) newTasks = sliceOne( task ); // if still no result, try sliceOne

	return newTasks;

}


function sliceFlat( task, prev ){
	// slice task into a main subtask at full power, a remainder subtask of one time unit at less than full power, and an idle subtask

	var l0 = task[1]-task[0]+1, // length i.e. duration of task
		l1, // length of main subtask including remainder
		l2, // length of main subtask excluding remainder
		p, // power of main subtask
		r, // power of remainder subtask
		i, // time index
		s, // battery state
		t = task[3]-task[2], // power differential of task
		newTasks = []; // array of subtasks

	if( t < 0 ){ // if task is to discharge
		l1 = Math.ceil( -t/PowerDown); // set l1
		l2 = Math.floor( -t/PowerDown ); // set l2
		p = -PowerDown; // set p
		r = t + l2*PowerDown; // set r

	}else{ // if task is to charge up
		l1 = Math.ceil( t/PowerUp); // set l1
		l2 = Math.floor( t/PowerUp ); // set l2
		p = PowerUp; // set p
		r = t - l2*PowerUp;	// set r		
	}

	i = task[0]; // set start time
	s = task[2]; // set initiale battery state

	if( Math.abs( prev ) < Math.abs( p - prev ) ){
		if( l1 < l0 ){
			newTasks.push( [ i, i+l0-l1-1, s, s, 0, true ] ); // submit idle subtask
			i += l0-l1; // update i
		}
		if( l2 < l1 ){
			newTasks.push( [ i, i, s, s+r, r, true ] ); // submit remainder subtask
			i++; // update i
			s += e; // update s
		}
	}

	if( l2 > 0 ){
		newTasks.push( [ i, i+l2-1, s, s+p*l2, p, true ] ); // submit main subtask
		i += l2; // update i
		s += p*l2; // update s
	}

	if( Math.abs( prev ) >= Math.abs( p - prev ) ){
		if( l2 != l1 ){
			newTasks.push( [ i, i, s, s+r, r, true ] ); // submit remainder subtask
			i++; // update i
			s += e; // update s
		}
		if( l1 < l0 ) newTasks.push( [ i, i+l0-l1-1, s, s, 0, true ] ); // submit idle subtask
	}

	return newTasks;

}


function sliceAlt( task, base ){
	// slice task into two subtasks
	// looking back two time units after change of direction for end of first subtask 

	var p = 0, // power
		prev, // previous power
		s1, // battery state at end of first subtask w/o correction for capacity
		s2, // battery state at end of first subtask w/ correction for capacity
		t = [ task[0], 0, task[2], 0, 0, true ], // subtask
		newTasks = [], // array of subtasks
		c; // value of the curve

	for( i = task[0]; i < task[1]+1; i++ ){	// loop through relevant section of TheCurve
		c = theCurve[i]; // update c
		prev = p; // update prev
		if( c > base ) p = -PowerDown; // update p
		if( c < base ) p = PowerUp;
		if( p * prev < 0 ) break; // on change of direction, break from for-loop
	}

	t[1] = i - 2; // set end time of subtask
	s1 = t[2] + prev * ( t[1] - t[0] + 1 ); // determine s1
	s2 = Math.max( 0, Math.min( Capacity, s1 ) ); // determine s2
	t[3] = s2; // set battery end state of subtask
	t[4] = prev; // set power during subtask
	if( s1 != s2 ) t[5] = false; // mark subtask as unresolved if it goes out of bounds
	newTasks.push( t ); // submit subtask
	
	t = [ i - 1, task[1], s2, task[3], 0, false ]; // set final subtask
	newTasks.push( t ); // submit subtask
	
	newTasks = correctLast( task, newTasks );

	return newTasks;

}



function sliceOne( task ){
	// slice task into a main subtask at full power and a remainder subtask of one time unit at less than full power

	var l0 = task[1]-task[0]+1, // length i.e. duration of task
		d = task[3]-task[2], // differential to be covered during task
		curve = TheCurve.slice( task[0], task[1]+1 ), // relevant slice of TheCurve
		p, // power of main subtask
		r, // power of remainder subtask
		m, // min or max of curve
		i, // index of m in the curve
		newTasks = []; // array of subtasks

	if( d < 0 ){
		r = d + (l0-1)*PowerDown; // set e
		p = -PowerDown; // set p
		m = Math.min.apply( Math, curve ); // set m min of curve
	}else{
		r = d - (l0-1)*PowerUp; // set e
		p = PowerUp; // set p
		m = Math.max.apply( Math, curve ); // set m to max of curve
	}

	i = curve.indexOf( m ); // determine where m is in the curve
	if( i == 0 ){ // if m is at the front of the curve
		newTasks.push( [ task[0], task[0], task[2], task[2] + r, r, true ] ); // submit remainder subtask
		newTasks.push( [ task[0]+1, task[1], task[2] + r, task[3], p, true ] ); // submit main subtask
	}else if( i == l0-1 ){ // if m is at the end of the curve
		newTasks.push( [ task[0], task[1]-1, task[2], task[3] - r, p, true ] ); // submit main subtask
		newTasks.push( [ task[1], task[1], task[3] - r, task[3], r, true ] ); // submit remainder subtask
	}else{ // if m is in the middle of the curve 
		newTasks.push( [ task[0], task[0]+i-1, task[2], task[2] + (i-1)*p, p, true ] ); // submit front part of main subtask
		newTasks.push( [ task[0]+i, task[0]+i, task[2] + (i-1)*p, task[2] + (i-1)*p + r, r, true ] ); // submit remainder subtask
		newTasks.push( [ task[0]+i+1, task[1], task[2] + (i-1)*p + r, task[3], p, true ] ); // submit rear part of main subtask
	}

	return newTasks;

}



function correctLast( task, newTasks ){
	// check whether final subtask actually brings battery in desired end state
	// if not, then merge with penultimate subtask
	// and check that one, i.e. recursion

	var t = newTasks.pop(), // open last subtask
		s = t[3], // battery end state of last subtask (which was set to battery end state of task)
		p = t[4], // power of last subtask
		l0 = t[1] - t[0] + 1, // length i.e. duration of last subtask
		d = t[3] - t[2], // differential to be covered during last subtask
		corrected = false; // mark that no correction has been made so far

	if( d > 0 && d/l0 > PowerUp || d < 0 && d/l0 < -PowerDown ){ // if last subtask cannot be fulfilled
		t = newTasks.pop(); // open last subtask, originally the penultimate subtask
		corrected = true; // mark that correction has been made
		t[1] = task[1]; // adjust end time of subtask to end time of task
		t[3] = task[3]; // adjust battery end state of subtask to battery end state of task
		t[5] = false; // mark subtask as unresolved
	}

	newTasks.push( t ); // submit subtask
	if( corrected ) newTasks = correctLast( task, newTasks ); // if correction was made, then check the corrected array of subtasks, i.e. recursion
	
	return newTasks;

}
