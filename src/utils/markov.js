class Markov {
	constructor(input = []) {
		this.chain = [];
		this.fs = require('fs');
		if (typeof input === 'object') {
			input.forEach(item => this.add(item));
		} else {
			this.add(input);
		}
	}

	add(input) {
		if (typeof input === 'string') {
			const tokens = input.split(/[\s]/);
			if (tokens.length == 1) {
				for (let i = 0; i < tokens.length; i++) {
					this.buildChain(tokens[i].toLowerCase(), tokens[i].toLowerCase());
				}
			} else {
				for (let i = 0; i < tokens.length - 1; i++) {
					this.buildChain(tokens[i].toLowerCase(), tokens[i + 1].toLowerCase());
				}
			}
		} else if (typeof input === 'object') {
			input.forEach(token => this.add(token));
		}
	}

	load(filename) {
		this.chain = JSON.parse(this.fs.readFileSync(filename, 'utf8'));
	}

	loadTelegram(filename, username) {
		const data = JSON.parse(this.fs.readFileSync(filename), 'utf8').messages
			.filter(message => typeof message.text === 'string')
			.filter(message => (message.text.length > 5) && (message.text.indexOf('[object Object]') == -1))
			.filter(message => message.forwarded_from === undefined)
			.map(message => {
				return {
					from: message.from,
					text: message.text
				}
			})
			.filter(message => message.from == username)
			.map(message => message.text.replace("\\n", "\n"));
		data.forEach(token => this.add(token));
	}

	save(filename) {
		this.fs.writeFileSync(filename, JSON.stringify(this.chain));
	}

	buildChain(currentToken, nextToken) {

		let found = false;
		for (let i = 0; i < this.chain.length; i++) {
			const currentRow = this.chain[i];
			const currentKey = currentRow.key;

			if (currentKey === currentToken) {

				found = true;
				let increased = false;

				//Now check if the next token exists somewhere
				for (let n = 0; n < currentRow.values.length; n++) {
					if (currentRow.values[n].next === nextToken) {
						currentRow.values[n].count++;
						currentRow.total++;
						increased = true;
						break;
					}
				}


				if (!increased) {
					this.chain[i].values.push({
						next: nextToken,
						count: 1
					});

					this.chain[i].total++;

				}
			}
		}
		
		if (!found && nextToken !== '') {
			this.chain.push({
				key: currentToken,
				values: [{
					next: nextToken,
					count: 1
				}],
				total: 1
			});
		}
	}

	generate_low(textLength = 70) {
		const random = Math.floor(Math.random() * this.chain.length);
		try {
			let result = this.chain[random].key;
			let nextState = this.addWord(random);
			let length = this.getRandomInt(1, textLength)

			if (result == nextState) return this.fixCapitals(result).toLowerCase();
			if (result.length < length) result += ' ' + nextState;
	
			while (result.length < length) {
				nextState = this.addWord(this.chain.map(word => word.key).indexOf(nextState));
				if (nextState === -1) break;
	
				result += ' ' + nextState;
			}
	
			return this.fixCapitals(result).toLowerCase();
		} catch {/*pass*/}


	}

	generate_high(textLength = 70) {
		try {
			const random = Math.floor(Math.random() * this.chain.length);
			let result = this.chain[random].key;
			let nextState = this.addWord(random);
			let length = this.getRandomInt(1, textLength)
	
			if (result == nextState) return this.fixCapitals(result);
			if (result.length < length) result += ' ' + nextState;
	
			while (result.length < length) {
				nextState = this.addWord(this.chain.map(word => word.key).indexOf(nextState));
	
				if (nextState === -1) break;
	
				result += ' ' + nextState;
			}
	
			return this.fixCapitals(result);
		} catch {/*pass*/}

	}

	fixCapitals(s) {
		return s.split('. ').map(sentence => this.firstCapital(sentence)).join('. ')
			.split('? ').map(sentence => this.firstCapital(sentence)).join('? ')
			.split('! ').map(sentence => this.firstCapital(sentence)).join('! ')
			.split('... ').map(sentence => this.firstCapital(sentence)).join('... ');
	}

	firstCapital(s) {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	addWord(rowIndex) {
		const currentRow = this.chain[rowIndex];

		//End of chain
		if (currentRow === undefined) return -1;

		const totalChoices = currentRow.total;
		const random = Math.floor(Math.random() * totalChoices);

		let selection = 0;
		let i = 0;
		while (selection < random) {
			selection += currentRow.values[i].count;

			if (selection > random) break;

			i++;
		}

		return currentRow.values[i].next;

	}

	getRandomInt(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}


module.exports = Markov;