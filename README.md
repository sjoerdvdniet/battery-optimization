# Battery optimization
Here a battery optimization technique is presented. There are, in fact, two algorithms: one optimizes the battery with respect to a load curve, doing peak reduction; the other with respect to a price curve, for maximum yield. At the heart is the same core idea, however. The algorithms can be more generally applied to similar questions with containers and flows.

## Peak reduction
Given a load curve and a battery, this algorithm computes how to employ the battery such that residual load is flattened, effectively shaving peaks both up and down. The battery charges when the load is low (or with excess supply), and it discharges when load is high (or with short supply). Timing is everything, as you wish to avoid that the battery is out of capacity when the highest peak has yet to come. The battery acts as medium, connecting demand and supply which peak at disparate moments. Inputs are battery capacity, its initial state, its desired end state and the load curve.

## Price optimization
Given a price curve and a battery, this algorithm computes how to employ the battery with maximum yield of price fluctuations. Charge when prices are low, discharge when prices are high. Timing is everything, and this algorithm ensures that the battery has capacity when the real price peak has yet to come. Inputs are battery capacity, its initial state, its desired end state and the price curve. If you wish to, for example, have your EV ready at 90% next morning, this can be taken care of.

## The core idea
The battery is given a task: to go from a given state to another, over some time, searching for optimal utilization given some reference curve. The idea is to resolve the task into ever smaller subtasks.

This is done by determining a baseline: a horizontal line that intersects the price curve or load curve. In the sections below the baseline, the battery will charge; in the sections below the baseline, the battery will discharge. For price optimization, power is assumed to equal full power for determining the baseline. For peak reduction, power is assumed to equal the difference between the load curve and the assumed baseline, capped by full power.

The baseline should be placed such that the sum meets the task. This can be computed at once for price optimization; an approximation method is used for peak reduction. Now, it could be that the battery is assumed to charge above capacity or discharge below zero. Where this is the case, these sections do not constitute the solution. Not yet.

They do constistute new tasks, which can be fed into the algorithm in turn. That's it.

## Pro's and cons
The algorithms are fast and accurate. However, they require (perfect) foresight and are not versatile. The load or price curve is assumed to be a given, and the solution is optimal only if the task is not broken up. That makes it difficult - if not impossible - to embed these algorithms into an integrated approach that constantly assesses for what purpose or on which market to employ the battery. The reason is that they work from the outside inwards: information about the curve for the entire duration of the task is brought to bear on the solution for each and every moment. Finally, it is difficult - if not impossible - to integrate energy losses while idle (losses when charging or discharging can be accommodated, although it isn't included at the moment).
