var util = require('../util');

var constants = require('../util/constants');
var intl = require('../intl');

var Commands = require('../commands');
var Errors = require('../util/errors');
var CommandProcessError = Errors.CommandProcessError;
var LocaleStore = require('../stores/LocaleStore');
var LocaleActions = require('../actions/LocaleActions');
var LevelStore = require('../stores/LevelStore');
var GlobalStateStore = require('../stores/GlobalStateStore');
var GlobalStateActions = require('../actions/GlobalStateActions');
var GitError = Errors.GitError;
var Warning = Errors.Warning;
var CommandResult = Errors.CommandResult;

var instantCommands = [
  // Add a third and fourth item in the tuple if you want this to show
  // up in the `show commands` function
  [/^ls( |$)/, function() {
    throw new CommandResult({
      msg: intl.str('ls-command')
    });
  }],
  [/^cd( |$)/, function() {
    throw new CommandResult({
      msg: intl.str('cd-command')
    });
  }],
  [/^(locale|locale reset)$/, function(bits) {
    LocaleActions.changeLocale(
      LocaleStore.getDefaultLocale()
    );

    throw new CommandResult({
      msg: intl.str(
        'locale-reset-command',
        { locale: LocaleStore.getDefaultLocale() }
      )
    });
  }, 'locale', 'change locale from the command line, or reset with `locale reset`'],
  [/^show$/, function(bits) {
    var lines = [
      intl.str('show-command'),
      '<br/>',
      'show commands',
      'show solution',
      'show goal'
    ];

    throw new CommandResult({
      msg: lines.join('\n')
    });
  }, 'show', 'Run `show commands|solution|goal` to see the available commands or aspects of the current level'],
  [/^alias (\w+)="(.+)"$/, function(bits) {
    const alias = bits[1];
    const expansion = bits[2];
    LevelStore.addToAliasMap(alias, expansion);
    throw new CommandResult({
      msg: 'Set alias "'+alias+'" to "'+expansion+'"',
    });
  }, 'alias', 'Run `alias` to map a certain shortcut to an expansion'],
  [/^unalias (\w+)$/, function(bits) {
    const alias = bits[1];
    LevelStore.removeFromAliasMap(alias);
    throw new CommandResult({
      msg: 'Removed alias "'+alias+'"',
    });
  }, 'unalias', 'Opposite of `alias`'],
  [/^locale (\w+)$/, function(bits) {
    LocaleActions.changeLocale(bits[1]);
    throw new CommandResult({
      msg: intl.str(
        'locale-command',
        { locale: bits[1] }
      )
    });
  }],
  [/^flip$/, function() {
    GlobalStateActions.changeFlipTreeY(
      !GlobalStateStore.getFlipTreeY()
    );
    require('../app').getEvents().trigger('refreshTree');
    throw new CommandResult({
      msg: intl.str('flip-tree-command')
    });
  }, 'flip', 'flip the direction of the tree (and commit arrows)'],
  [/^disableLevelInstructions$/, function() {
    GlobalStateActions.disableLevelInstructions();
    throw new CommandResult({
      msg: intl.todo('Level instructions disabled'),
    });
  }, 'disableLevelInstructions', 'Disable the level instructions'],
  [/^refresh$/, function() {
    var events = require('../app').getEvents();

    events.trigger('refreshTree');
    throw new CommandResult({
      msg: intl.str('refresh-tree-command')
    });
  }],
  [/^rollup (\d+)$/, function(bits) {
    var events = require('../app').getEvents();

    // go roll up these commands by joining them with semicolons
    events.trigger('rollupCommands', bits[1]);
    throw new CommandResult({
      msg: 'Commands combined!'
    });
  }],
  [/^echo "(.*?)"$|^echo (.*?)$/, function(bits) {
    var msg = bits[1] || bits[2];
    throw new CommandResult({
      msg: msg
    });
  }, 'echo', 'echo out a string to the terminal output'],
  [/^show +commands$/, function(bits) {
    var allCommands = Object.assign(
      {},
      getAllCommands()
    );
    var allOptions = Commands.commands.getOptionMap();
    var commandToOptions = {};

    Object.keys(allOptions).forEach(function(vcs) {
      var vcsMap = allOptions[vcs];
      Object.keys(vcsMap).forEach(function(method) {
        var options = vcsMap[method];
        if (options) {
          commandToOptions[vcs + ' ' + method] = Object.keys(options).filter(option => option.length > 1);
        }
      });
    });

    var selectedInstantCommands = {};
    instantCommands.map(
      tuple => {
        var commandName = tuple[2];
        if (!commandName) {
          return;
        }
        commandToOptions[commandName] = [tuple[3]];
        // add this as a key so we map over it
        allCommands[commandName] = tuple[3];
        // and save it in another map so we can add extra whitespace
        selectedInstantCommands[commandName] = tuple[3];
      },
    );

    var lines = [
      intl.str('show-all-commands'),
      '<br/>'
    ];
    Object.keys(allCommands)
      .forEach(function(command) {
        if (selectedInstantCommands[command]) {
          lines.push('<br/>');
        }
        lines.push(command);
        if (commandToOptions[command]) {
          commandToOptions[command].forEach(option => lines.push('&nbsp;&nbsp;&nbsp;&nbsp;' + option));
        }

        if (selectedInstantCommands[command]) {
          lines.push('<br/>');
        }
      });

    throw new CommandResult({
      msg: lines.join('\n')
    });
  }]
];

var regexMap = {
  'reset solved': /^reset solved($|\s)/,
  'help': /^help( +general)?$|^\?$/,
  'reset': /^reset( +--forSolution)?$/,
  'delay': /^delay (\d+)$/,
  'clear': /^clear($|\s)/,
  'exit level': /^exit level($|\s)/,
  'sandbox': /^sandbox($|\s)/,
  'level': /^level\s?([a-zA-Z0-9]*)/,
  'levels': /^levels($|\s)/,
  'build level': /^build +level\s?([a-zA-Z0-9]*)( +--skipIntro)?$/,
  'export tree': /^export +tree$/,
  'importTreeNow': /^importTreeNow($|\s)/,
  'importLevelNow': /^importLevelNow($|\s)/,
  'import tree': /^import +tree$/,
  'import level': /^import +level$/,
  'undo': /^undo($|\s)/,
  'share permalink': /^share( +permalink)?$/
};

var getAllCommands = function() {
  var toDelete = [
    'mobileAlert'
  ];

  var allCommands = Object.assign(
    {},
    require('../level').regexMap,
    regexMap
  );
  var mRegexMap = Commands.commands.getRegexMap();
  Object.keys(mRegexMap).forEach(function(vcs) {
    var map = mRegexMap[vcs];
    Object.keys(map).forEach(function(method) {
      var regex = map[method];
      allCommands[vcs + ' ' + method] = regex;
    });
  });
  toDelete.forEach(function(key) {
    delete allCommands[key];
  });

  return allCommands;
};

exports.getAllCommands = getAllCommands;
exports.instantCommands = instantCommands;
exports.parse = util.genParseCommand(regexMap, 'processSandboxCommand');

// optimistically parse some level and level builder commands; we do this
// so you can enter things like "level intro1; show goal" and not
// have it barf. when the
// command fires the event, it will check if there is a listener and if not throw
// an error

// note: these are getters / setters because the require kills us
exports.getOptimisticLevelParse = function() {
  return util.genParseCommand(
    require('../level').regexMap,
    'processLevelCommand'
  );
};

exports.getOptimisticLevelBuilderParse = function() {
  return util.genParseCommand(
    require('../level/builder').regexMap,
    'processLevelBuilderCommand'
  );
};
