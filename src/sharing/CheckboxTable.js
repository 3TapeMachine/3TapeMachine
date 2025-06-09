import 'd3';

const identity = x => x;
const head = array => array[0];

/**
 * A <table> that includes a checkbox in front of each row,
 * and a header checkbox to (de)select all rows.
 */
export default class CheckboxTable {
  /**
   * @param {Object} args
   * @param {d3.Selection<HTMLTableElement>} args.table - D3 selection of the table element
   * @param {string[]} [args.headers] - Column headers
   * @param {string[][]} [args.data] - Table data
   */
  constructor(args) {
    this.table = args.table;
    this.headerRow = this.table.append('thead').append('tr');
    this.tbody = this.table.append('tbody');

    // Header checkbox (selects/deselects all checkboxes)
    this.headerCheckbox = this.headerRow
      .append('th')
      .attr('class', 'checkbox-cell')
      .append('input')
      .attr('type', 'checkbox')
      .on('click', (act) => {
        this.getCheckboxes().property('checked', act.target.checked);
        this.onChange();
      });

    // Event delegation for row clicks (using D3)
    this.tbody.on('click', (act) => {
      const tr = act.target.closest('tr');
      if (!tr) return;
      if (act.target.tagName !== 'INPUT') {
        const box = tr.querySelector('input[type="checkbox"]');
        if (box) box.checked = !box.checked;
      }
      this.refresh();
      this.onChange();
    });

    // Set headers and data if provided
    if (args.headers) this.setHeaders(args.headers);
    if (args.data) this.setData(args.data);
  }

  /**
   * Set the column headers.
   * @param {string[]} headers
   */
  setHeaders(headers) {
    const th = this.headerRow
      .selectAll('th:not(.checkbox-cell)')
      .data(headers);

    th.exit().remove();
    th.enter().append('th');
    th.text(identity);
  }

  /**
   * Set the table body data.
   * Each row begins with a checkbox whose .value is the first cell.
   * Rows are keyed by the first cell when updating data.
   * @param {string[][]} data
   * @return {CheckboxTable}
   */
  setData(data) {
    const tr = this.tbody.selectAll('tr')
      .data(data, head);

    tr.exit().remove();

    const trEnter = tr.enter().append('tr');
    // Checkbox at the start of each row
    trEnter.append('td')
      .attr('class', 'checkbox-cell')
      .append('input')
      .attr('type', 'checkbox')
      .attr('value', head);

    tr.order();

    // Row cells
    const td = tr.selectAll('td:not(.checkbox-cell)')
      .data(identity);

    td.exit().remove();
    td.enter().append('td');
    td.text(identity);

    return this;
  }

  getCheckboxes() {
    return this.tbody.selectAll('input[type="checkbox"]');
  }

  getCheckedValues() {
    // D3 v6+ returns a selection, use .nodes() to get DOM nodes
    return this.tbody.selectAll('input[type="checkbox"]:checked')
      .nodes()
      .map(x => x.value);
  }

  isCheckedEmpty() {
    const headerBox = this.headerCheckbox.node();
    return !(headerBox.checked || headerBox.indeterminate);
  }

  /**
   * Refresh the header checkbox (called after a row checkbox is toggled).
   */
  refresh() {
    const headerBox = this.headerCheckbox.node();
    const boxes = this.getCheckboxes();
    const total = boxes.size();
    const checked = boxes.filter(function () { return self.checked; }).size();

    if (checked === 0) {
      headerBox.checked = false;
    } else if (checked === total) {
      headerBox.checked = true;
    }
    headerBox.indeterminate = (0 < checked && checked < total);
  }

  // Configurable. Called after a click toggles a row or header checkbox.
  onChange() {}
}
