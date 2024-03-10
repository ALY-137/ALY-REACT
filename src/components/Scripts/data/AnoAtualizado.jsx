import React from 'react';

class AnoAtualizado extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      ano: new Date().getFullYear()
    };
  }

  render() {
    return (
      <span style={{ display: 'inline' }}>
      {this.state.ano}
      </span>
    );
  }
}

export default AnoAtualizado;