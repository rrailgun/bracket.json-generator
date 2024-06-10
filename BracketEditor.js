const fs = require("fs"),
    readline = require('readline'),
    inquirer = require('inquirer'),
    PremadeBrackets = require('./PremadeBrackets');

let bracket = {}

inquirer.prompt([
    {
        type: 'list',
        message: "Read in current bracket.json file or start from a template?",
        name: 'loadbracket',
        choices: [
            { name: "Load in a bracket.js", value: true },
            { name: "Start from a template", value: false }
        ]
    }
])
    .then(answer => {
        if (answer['loadbracket']) {
            fs.readFile('bracket.json', 'utf8', (err, data) => {
                if (err) console.log(err.message)
                else {
                    bracket = JSON.parse(data);
                    console.log("Provided bracket.json loaded in.")
                    mainMenu()
                }
            })
        }
        else {
            inquirer.prompt([
                {
                    type: 'list',
                    message: "Select a bracket type for this template.",
                    name: 'bracketType',
                    choices: Object.keys(PremadeBrackets.BracketTemplates)
                },
                {
                    type: 'input',
                    message: 'Enter start date of the first bracket round of the tournament YYYY-MM-DD. Each following round will start exactly seven days after the previous round.',
                    name: 'roundDate',
                    default: new Date().toISOString()
                }
            ])
                .then(answer => {
                    bracket = PremadeBrackets.BracketTemplates[answer.bracketType]
                    let startDate = new Date(answer.roundDate).getTime();
                    for (let i = 0; i < bracket.Rounds.length; i++) {
                        bracket.Rounds[i]['StartDate'] = new Date(startDate + (604800000 * i)).toISOString() //604800000 is 7 days in milliseconds
                    }
                    for (let i = 0; i < bracket.Matches; i++) {
                        bracket.Matches[i]["Date"] = ""
                    }

                    console.log(`${answer.bracketType} bracket template loaded in.`)
                    mainMenu()
                })
        }
    })

function updateTeamMenu() {
    inquirer.prompt([
        {
            type: 'list',
            message: "Select an operation to modify bracket.json",
            name: 'operations',
            choices: [
                { name: "Populate teams from teams.tsv", value: "populateTeams" },
                { name: "Add seedings to teams", value: 'addSeedings' },
                { name: "Add qualifier stat data", value: "addQualStatsInfo" },
                { name: "Return to main menu", value: "returnToMainMenu" }
            ]
        }
    ])
    .then( answer => {
        switch(answer.operations) {
            case 'populateTeams':
                populateTeams();
                break;
            case 'addQualStatsInfo':
                addQualStatsInfo();
                break;
            case 'addSeedings':
                    teamSeeding();
                    break;
            case 'returnToMainMenu':
                mainMenu();
                break;
        }
    })
}

function matchMenu() {
    inquirer.prompt([
        {
            type: 'list',
            message: "Select an operation to modify bracket.json",
            name: 'operations',
            choices: [
                { name: "Create initial matchups \x1b[31m\x1b[1m(WARNING: THIS SHOULD ONLY BE USED WITH A TEMPLATE MADE FROM THIS SCRIPT)\x1b[0m", value: 'createMatchups' },
                { name: "Update a rounds match data from matches.tsv", value: "updateMatches" },
                { name: "Return to main menu", value: "returnToMainMenu" }
            ]
        }
    ])
        .then(answer => {
            switch (answer.operations) {
                case 'updateMatches':
                    updateMatches();
                    break;
                case 'createMatchups':
                    populateInitialBracket();
                    break;
                case 'returnToMainMenu':
                    mainMenu();
                    break;
            }
        })
}

function mainMenu() {

    inquirer.prompt([
        {
            type: 'list',
            message: "Select an operation to modify bracket.json",
            name: 'mainMenuOption',
            choices: [
                { name: "Update team data", value: "updateTeam" },
                { name: "Update match data", value: "updateMatch" },
                { name: "Populate round with beatmaps from beatmaps.tsv", value: "populateBeatmaps" },
                { name: "Save and exit bracket editor", value: "exitSave" },
                { name: "Exit bracket editor without saving", value: "exitNoSave" }
            ]
        }
    ])
    .then( answer => {
        switch(answer.mainMenuOption) {
            case "updateTeam":
                updateTeamMenu();
                break;
            case "updateMatch":
                matchMenu();
                break;
            case 'populateBeatmaps':
                populateBeatmaps();
                break;
            case 'exitSave':
                fs.writeFile('bracket.json', JSON.stringify(bracket, null, 4), err => {
                    if (err) {
                        console.log(err);
                        mainMenu();
                    }
                    else {
                        console.log("bracket.json saved. Exiting...")
                        process.exit()
                    }
                });
                break;
            case 'exitNoSave':
                console.log("Exiting without saving...")
                process.exit();
        }
    })
}

function populateInitialBracket() {
    let teamList = bracket.Teams;
    let matchups = bracketPlacement(bracket.Rounds[0].Matches.length * 2);
    let match = 0;
    for (let i = 0; i < matchups.length - 1; i += 2) {
        if (bracket.Teams[matchups[i] - 1] !== undefined) bracket.Matches[match]['Team1Acronym'] = bracket.Teams[matchups[i] - 1]['Acronym']
        if (bracket.Teams[matchups[i + 1] - 1] !== undefined) bracket.Matches[match]['Team2Acronym'] = bracket.Teams[matchups[i + 1] - 1]['Acronym']
        match++;
    }
    console.log("Initial matches made");
    mainMenu();
}

//Credit https://stackoverflow.com/questions/8355264/tournament-bracket-placement-algorithm
function bracketPlacement(numPlayers) {
    var rounds = Math.log(numPlayers) / Math.log(2) - 1;
    var pls = [1, 2];
    for (var i = 0; i < rounds; i++) {
        pls = nextLayer(pls);
    }
    return pls;
    function nextLayer(pls) {
        var out = [];
        var length = pls.length * 2 + 1;
        pls.forEach(function (d) {
            out.push(d);
            out.push(length - d);
        });
        return out;
    }
}

function populateTeams() {
    let teams = []
    let acronymSet = new Set();
    fs.readFile('sheets/teams.tsv', 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        let lines = data.split('\r\n')
        lines.forEach((e, i) => {
            let lineSplitData = e.split('\t').map(e => e.trim())
            if (lineSplitData.length < 2) return;
            let team = {}
            team['FullName'] = lineSplitData[0]
            team['FlagName'] = " "
            //Temporary, Acronyms need to be unique
            let tempAcronym = lineSplitData[0].substring(0, 4).toUpperCase()
            if (acronymSet.has(tempAcronym)) {
                console.log(`\x1b[33m\x1b[1mNOTICE: Duplicate acronym "${tempAcronym}" generated for team ${lineSplitData[0]}. Acronyms must be unique to each team. Setting ${i} as acronym.\x1b[0m`);
                team['Acronym'] = i;
            }
            else {
                team['Acronym'] = tempAcronym;
                acronymSet.add(tempAcronym);
            }
            team["Players"] = []
            for (let i = 1; i < lineSplitData.length; i++) {
                if (lineSplitData[i] != "") team["Players"].push({ "id": parseInt(lineSplitData[i]) })
            }
            teams.push(team)
        })
        bracket['Teams'] = teams
        console.log("Teams imported")
        mainMenu();
    });
}

function selectRound() {
    if (bracket.Rounds.length < 1) {
        console.log("The bracket must have at least one round.")
        return null;
    }
    else {
        return inquirer.prompt([
            {
                type: 'list',
                message: 'Select the round',
                name: 'selectedRound',
                choices: bracket.Rounds.map((e, i) => ({ name: e.Name, value: i }))
            }
        ])
    }
}

function populateBeatmaps() {
    roundPromise = selectRound();
    if (roundPromise === null) mainMenu();
    else {
        roundPromise.then(answers => {
            let round = bracket.Rounds[answers.selectedRound]
            fs.readFile('sheets/beatmaps.tsv', 'utf-8', (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                let lines = data.split('\r\n')
                lines.forEach(e => {
                    let splitData = e.split('\t').map(e => e.trim())
                    if (splitData < 1) return;
                    round.Beatmaps.push({ ID: splitData[1], Mods: splitData[0] })
                })
                bracket.Rounds[answers.selectedRound] = round;
                console.log("Beatmaps imported")
                mainMenu()
            })
        })
    }
}

/*
quals.tsv:
Line 1: Mods of each map (EX. NM1 NM2)
Line 2: Each Beatmap ID, corresponding to the mod above its cell
Line 3-n: Team name, followed by the team score for each map in order as described in lines 1+2

It is 6:49 AM and I just finished this up. I hope no one needs to go through this spaghetii for a long time
*/
function addQualStatsInfo() {
    let teams = bracket.Teams;
    if (teams.length < 1) {
        console.log("Add teams to the bracket before adding qualifier stats.")
        mainMenu();
    }
    else fs.readFile('sheets/quals.tsv', 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Importing scores and calculating map rank...")
        let finalData = {}
        let lines = data.split('\r\n')
        let mods = lines.shift().split('\t');
        let maps = lines.shift().split('\t');
        for (let i = 0; i < mods.length; i++) {
            finalData[mods[i]] = {
                "ID": maps[i],
                "teamScores": []
            }
        }
        /*
        finalData will look like:
        {
            NM1: {
                ID: 3990448,
                teamScores: [
                    {team1: 100000},
                    {team2: 200000}
                ]
            },
            ...
        }
        */
        //This loads all the scores from the tsv into the JSON format above
        lines.forEach((e) => {
            let splitData = e.split('\t').map(e => e.trim())
            let teamName = splitData.shift();
            splitData.forEach((mapScore, i) => {
                finalData[mods[i]]['teamScores'].push({ [teamName]: parseInt(mapScore) })
            })
        })
        //Sorts each maps scores list
        for (let i = 0; i < mods.length; i++) {
            finalData[mods[i]]['teamScores'].sort((a, b) => {
                let aKey = Object.keys(a)[0]
                let bKey = Object.keys(b)[0]
                return a[aKey] < b[bKey] ? 1 : (a[aKey] > b[bKey] ? -1 : 0)
            })
        }
        let modRank = [];
        bracket.Teams.forEach((e, i) => {
            let teamObj = { "teamName": e.FullName }
            teamObj['teamIndex'] = i
            Array.from(new Set(mods.map(e => e.substring(0, 2)))).forEach(j => {
                teamObj[j] = 0;
            })
            modRank.push(teamObj)
        })
        /*
        {
            "teamName" :"team1",
            "teamIndex": 0, //Index for team in bracket.Teams
            "NM": 3, //summation of seeds, then sort to rank them to get seed from index+1
            ...
        }
        */
        //Add each map to each team with their scores and map seed (based on index from sort before this)
        let modTypes = Array.from(new Set(mods.map(e => e.substring(0, 2))));
        bracket.Teams.forEach((e, teamIndex) => {
            let seedingResults = [... new Set(mods.map(e => e.substring(0, 2)))].map(e => ({
                "Beatmaps": [],
                "Mod": e
            }))
            for (let i = 0; i < mods.length; i++) {
                let mapToInsert = {
                    "ID": finalData[mods[i]]['ID']
                }
                for (let j = 0; j < finalData[mods[i]]['teamScores'].length; j++) {
                    let key = Object.keys(finalData[mods[i]]['teamScores'][j])[0]
                    if (e.FullName == key) {
                        mapToInsert['Score'] = finalData[mods[i]]['teamScores'][j][key]
                        mapToInsert['Seed'] = j + 1;
                        modRank[teamIndex][mods[i].substring(0, 2)] += j + 1 //Sum the seed here to rank for the entire mod after
                        break;
                    }
                }
                // for (let j=0;j<seedingResults.length;j++) {
                //     if (seedingResults[j]['Mod'] == mods[i].substring(0,2)) seedingResults[j]['Beatmaps'].push(mapToInsert)
                // }
                seedingResults[modTypes.indexOf(mods[i].substring(0, 2))]['Beatmaps'].push(mapToInsert)
            }
            bracket.Teams[teamIndex]['SeedingResults'] = seedingResults;
        })
        console.log("Scores imported. Calculating mod seeds...")
        modTypes.forEach((e, j) => {
            modRank.sort((a, b) => {
                return a[e] < b[e] ? -1 : (a[e] > b[e] ? 1 : 0)
            })
            for (let i = 0; i < modRank.length; i++) {
                bracket.Teams[modRank[i]['teamIndex']]["SeedingResults"][j]["Seed"] = i + 1;
            }
        })
        console.log("Mod seeds imported")
        mainMenu();
    })
}

function teamSeeding() {
    let teams = bracket.Teams;
    if (teams.length < 1) {
        console.log("Add teams to the bracket before modifying seedings.")
        mainMenu();
    }
    else fs.readFile('sheets/seedings.tsv', 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        let jsonSeedings = {}
        let lines = data.split('\r\n')
        lines.forEach(e => {
            let seeding = e.split('\t').map(e => e.trim())
            jsonSeedings[seeding[1]] = parseInt(seeding[0])
        })
        for (let i = 0; i < teams.length; i++) {
            teams[i]["Seed"] = parseInt(jsonSeedings[teams[i]['FullName']])
        }
        teams.sort((a, b) => {
            return a['Seed'] < b['Seed'] ? -1 : (a['Seed'] > b['Seed'] ? 1 : 0)
        })
        bracket.Teams = teams;
        console.log("New seedings have been applied.")
        mainMenu();
    })
}


//TODO: Apply progressions when given results
function updateMatches() {
    roundPromise = selectRound();
    if (roundPromise === null) mainMenu();
    else {
        roundPromise.then(answers => {
            let matchesToUpdateIDs = bracket.Rounds[answers.selectedRound]['Matches'] //IDs from Lazer client (NOT MATCH IDS ON SHEET)
            let matchIndexesToUpdate = []
            for (let i = 0; i < bracket.Matches.length && matchIndexesToUpdate.length != matchesToUpdateIDs.length; i++) {
                if (matchesToUpdateIDs.includes(bracket.Matches[i]["ID"])) matchIndexesToUpdate.push(i)
            }
            let teamAcr = {}
            for (let i = 0; i < bracket.Teams.length; i++) {
                teamAcr[bracket.Teams[i].FullName] = bracket.Teams[i].Acronym; //Teams are given matches by Acronyms, but sheets use teams full names
            }
            fs.readFile('sheets/matches.tsv', 'utf-8', (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                let lines = data.split('\r\n')
                let current = new Date();
                lines.forEach((e, i) => {
                    let splitData = e.split('\t').map(e => e.trim())
                    let matchDate = new Date(splitData[0] + " " + splitData[1]);
                    matchDate = new Date(matchDate.valueOf() - (new Date().getTimezoneOffset() * 60000)); //Removes system timezone as provided dates are in UTC
                    if (matchDate.getMonth() == 0 && current.getMonth() == 11) matchDate.setFullYear(current.getFullYear() + 1)
                    else matchDate.setFullYear(current.getFullYear())
                    let team1Acr = teamAcr[splitData[2]]
                    let team2Acr = teamAcr[splitData[3]]
                    let found = false;
                    for (let i = 0; i < matchIndexesToUpdate.length; i++) {
                        if (bracket.Matches[matchIndexesToUpdate[i]]['Team1Acronym'] == team1Acr &&
                            bracket.Matches[matchIndexesToUpdate[i]]['Team2Acronym'] == team2Acr) {
                            found = true;
                            bracket.Matches[matchIndexesToUpdate[i]]['Date'] = matchDate.toISOString();
                            if (splitData.length === 6 && splitData[4] != "" && splitData[5] != "") { //Score included in tsv
                                //Assuming score is only provided after a match has concluded, and the higher score is the team that won the match
                                bracket.Matches[matchIndexesToUpdate[i]]['Team1Score'] = parseInt(splitData[4])
                                bracket.Matches[matchIndexesToUpdate[i]]['Team2Score'] = parseInt(splitData[5])
                                let progressionsForMatch = bracket.Progressions.filter(e => e.SourceID == bracket.Matches[matchIndexesToUpdate[i]]["ID"]); //Next (Lazer) Match IDs
                                // If the team progresses to another match, need to identify 1. Which match 2. Are they team1 or team2
                                let winningTeamAcronym = bracket.Matches[matchIndexesToUpdate[i]]['Team1Score'] > bracket.Matches[matchIndexesToUpdate[i]]['Team2Score'] ? bracket.Matches[matchIndexesToUpdate[i]]['Team1Acronym'] : bracket.Matches[matchIndexesToUpdate[i]]['Team2Acronym'];
                                let losingTeamAcronym = bracket.Matches[matchIndexesToUpdate[i]]['Team1Score'] < bracket.Matches[matchIndexesToUpdate[i]]['Team2Score'] ? bracket.Matches[matchIndexesToUpdate[i]]['Team1Acronym'] : bracket.Matches[matchIndexesToUpdate[i]]['Team2Acronym'];
                                if (progressionsForMatch.length > 0) { // Length = 0 - No further match, 1 - Winning team moves on, loser is done, 2 - Winning team moves on, Losers continues in LB
                                    // console.log(progressionsForMatch)
                                    let sourcesOfWinnersNextMatch = bracket.Progressions.filter(e => e.TargetID == progressionsForMatch[0].TargetID);
                                    // console.log(sourceOfWinnersNextMatch)
                                    let pos = sourcesOfWinnersNextMatch.indexOf(progressionsForMatch[0]) // 0=Team1, 1=Team2
                                    // console.log(pos)
                                    for (let j = 0; j < bracket.Matches.length; j++) {
                                        if (bracket.Matches[j]['ID'] == progressionsForMatch[0]['TargetID']) {
                                            if (pos == 0) bracket.Matches[j]['Team1Acronym'] = winningTeamAcronym;
                                            else bracket.Matches[j]['Team2Acronym'] = winningTeamAcronym;
                                            break;
                                        }
                                    }
                                }
                                if (progressionsForMatch.length > 1) { // Add losing team to LB
                                    let sourcesOfLosersNextMatch = bracket.Progressions.filter(e => e.TargetID == progressionsForMatch[1].TargetID);
                                    let pos = sourcesOfLosersNextMatch.indexOf(progressionsForMatch[1])
                                    for (let j = 0; j < bracket.Matches.length; j++) {
                                        if (bracket.Matches[j]['ID'] == progressionsForMatch[1]['TargetID']) {
                                            if (pos == 0) bracket.Matches[j]['Team1Acronym'] = losingTeamAcronym;
                                            else bracket.Matches[j]['Team2Acronym'] = losingTeamAcronym;
                                            break;
                                        }
                                    }
                                }

                            }
                            else {
                                bracket.Matches[matchIndexesToUpdate[i]]['Team1Score'] = null
                                bracket.Matches[matchIndexesToUpdate[i]]['Team2Score'] = null
                            }
                            break;
                        }
                    }
                    if (!found) console.log("\x1b[1m\x1b[33m%s\x1b[0m", `CAUTION: Match ${splitData[2]} vs ${splitData[3]} was not found.`)
                })
                console.log("Matches have been updated for " + bracket.Rounds[answers.selectedRound]["Name"])
                mainMenu()
            })
        })
    }
}