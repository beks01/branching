var PropTypes = require('prop-types');

var HelperBarView = require('../react_views/HelperBarView.jsx');
var Main = require('../app');
var React = require('react');

var log = require('../log');

class IntlHelperBarView extends React.Component{

  render() {
    return (
      <HelperBarView
        items={this.getItems()}
        shown={this.props.shown}
      />
    );
  }

  fireCommand(command) {
    log.viewInteracted('intlSelect');
    Main.getEventBaton().trigger('commandSubmitted', command);
    this.props.onExit();
  }

  getItems() {
    return [{
      text: 'English',
      testID: 'english',
      onClick: function() {
        this.fireCommand('locale en_US; levels');
      }.bind(this)
    }, {
      text: 'Deutsch',
      testID: 'german',
      onClick: function() {
        this.fireCommand('locale de_DE; levels');
      }.bind(this)
    }, {
      text: 'Русский',
      testID: 'russian',
      onClick: function() {
        this.fireCommand('locale ru_RU; levels');
      }.bind(this)
    }, {
      icon: 'fa-solid fa-right-from-bracket',
      onClick: function() {
        this.props.onExit();
      }.bind(this)
    }];
  }


};

IntlHelperBarView.propTypes = {
  shown: PropTypes.bool.isRequired,
  onExit: PropTypes.func.isRequired
}

module.exports = IntlHelperBarView;
