import { Context } from "../context/Context";
import { FrequencyClass } from "./Frequency";
import { TypeBaseClass, TypeBaseExpression, TypeBaseUnits } from "./TypeBase";

/**
 * TimeClass is a primitive type for encoding and decoding Time values.
 * TimeClass can be passed into the parameter of any method which takes time as an argument.
 * @param  val    The time value.
 * @param  units  The units of the value.
 * @example
 * var t = Time("4n");//a quarter note
 */
export class TimeClass<Type extends Seconds | Ticks = Seconds> extends TypeBaseClass<Type> {

	name = "Time";

	protected _getExpressions(defaultUnit): TypeBaseExpression<Type> {
		return Object.assign(super._getExpressions(defaultUnit), {
			now: {
				method: (capture: string): Type => {
					return this._now() + new TimeClass(this.context, capture).valueOf() as Type;
				},
				regexp: /^\+(.+)/,
			},
			quantize: {
				method: (capture: string): Type => {
					const quantTo = new TimeClass(this.context, capture).valueOf();
					if (this.context.transport) {
						return this._secondsToUnits(this.context.transport.nextSubdivision(quantTo));
					} else {
						return 0 as Type;
					}
				},
				regexp: /^@(.+)/,
			},
		});
	}

	/**
	 * Quantize the time by the given subdivision. Optionally add a
	 * percentage which will move the time value towards the ideal
	 * quantized value by that percentage.
	 * @param  val    The subdivision to quantize to
	 * @param  percent  Move the time value towards the quantized value by a percentage.
	 * @example
	 * Time(21).quantize(2) //returns 22
	 * Time(0.6).quantize("4n", 0.5) //returns 0.55
	 */
	quantize(subdiv: number | string | TimeObject, percent = 1): Type {
		const subdivision = new TimeClass(this.context, subdiv).valueOf();
		const value = this.valueOf();
		const multiple = Math.round(value / subdivision);
		const ideal = multiple * subdivision;
		const diff = ideal - value;
		return value + diff * percent as Type;
	}

	///////////////////////////////////////////////////////////////////////////
	// CONVERSIONS
	///////////////////////////////////////////////////////////////////////////
	/**
	 *  Convert a Time to Notation. The notation values are will be the
	 *  closest representation between 1m to 128th note.
	 *  @return {Notation}
	 *  @example
	 * //if the Transport is at 120bpm:
	 * Time(2).toNotation();//returns "1m"
	 */
	toNotation(): Subdivision {
		const time = this.toSeconds();
		const testNotations: Subdivision[] = ["1m"];
		for (let power = 1; power < 9; power++) {
			const subdiv = Math.pow(2, power);
			testNotations.push(subdiv + "n." as Subdivision);
			testNotations.push(subdiv + "n" as Subdivision);
			testNotations.push(subdiv + "t" as Subdivision);
		}
		testNotations.push("0");
		// find the closets notation representation
		let closest = testNotations[0];
		let closestSeconds = new TimeClass(this.context, testNotations[0]).toSeconds();
		testNotations.forEach(notation => {
			const notationSeconds = new TimeClass(this.context, notation).toSeconds();
			if (Math.abs(notationSeconds - time) < Math.abs(closestSeconds - time)) {
				closest = notation;
				closestSeconds = notationSeconds;
			}
		});
		return closest;
	}

	/**
	 *  Return the time encoded as Bars:Beats:Sixteenths.
	 */
	toBarsBeatsSixteenths(): BarsBeatsSixteenths {
		const quarterTime = this._beatsToUnits(1);
		let quarters = this.valueOf() / quarterTime;
		quarters = parseFloat(quarters.toFixed(4));
		const measures = Math.floor(quarters / this._getTimeSignature());
		let sixteenths = (quarters % 1) * 4;
		quarters = Math.floor(quarters) % this._getTimeSignature();
		const sixteenthString = sixteenths.toString();
		if (sixteenthString.length > 3) {
			// the additional parseFloat removes insignificant trailing zeroes
			sixteenths = parseFloat(parseFloat(sixteenthString).toFixed(3));
		}
		const progress = [measures, quarters, sixteenths];
		return progress.join(":");
	}

	/**
	 *  Return the time in ticks.
	 */
	toTicks(): Ticks {
		const quarterTime = this._beatsToUnits(1);
		const quarters = this.valueOf() / quarterTime;
		return Math.round(quarters * this._getPPQ());
	}

	/**
	 *  Return the time in seconds.
	 */
	toSeconds(): Seconds {
		return this.valueOf();
	}

	/**
	 *  Return the value as a midi note.
	 */
	toMidi(): MidiNote {
		return FrequencyClass.ftom(this.toFrequency());
	}

	protected _now(): Type {
		return this.context.now() as Type;
	}
}

export function Time(value?: Time, units?: TypeBaseUnits): TimeClass {
	return new TimeClass(Context.getGlobal(), value, units);
}
