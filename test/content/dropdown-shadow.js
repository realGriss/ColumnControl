describe('columnControl - dropdown DOM roots', function () {
	dt.libs({
		js: ['jquery', 'datatables', 'columncontrol'],
		css: ['datatables', 'columncontrol']
	});

	['document', 'open', 'closed'].forEach((mode) => {
		describe(mode + ' root', function () {
			let host, root, table, buttons;

			beforeEach(() => {
				host = document.createElement('div');
				host.style.cssText = 'position:relative; margin:80px 40px; width:700px';
				document.body.append(host);
				root = mode === 'document' ? host : host.attachShadow({ mode });
				root.innerHTML = `
					<style>
						.dt-container { position:relative; }
						.dt-column-header { display:flex; }
						.dtcc-dropdown { position:absolute; width:180px; margin:0; }
						table { width:100%; }
					</style>
					<table><thead><tr><th>Name</th><th>City</th></tr></thead>
					<tbody><tr><td>Alice</td><td>Berlin</td></tr>
					<tr><td>Bob</td><td>Paris</td></tr></tbody></table>`;
				table = new DataTable(root.querySelector('table'), {
					columnControl: [{
						extend: 'dropdown',
						content: ['searchText', ['orderAsc', 'orderDesc']]
					}]
				});
				buttons = root.querySelectorAll('thead .dtcc-button_dropdown');
			});

			afterEach(() => {
				table.destroy();
				host.remove();
			});

			it('Keeps input and select clicks inside the menu', () => {
				buttons[0].click();
				let menu = root.querySelector('.dtcc-dropdown');
				menu.querySelector('input').click();
				menu.querySelector('select').click();
				let input = menu.querySelector('input');
				input.value = 'Alice';
				input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
				expect(table.rows({ search: 'applied' }).count()).toBe(1);
				expect(menu.isConnected).toBe(true);
			});

			it('Closes the previous menu before opening another and toggles closed', () => {
				buttons[0].click();
				let first = root.querySelector('.dtcc-dropdown');
				buttons[1].click();
				expect(first.isConnected).toBe(false);
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(1);
				buttons[1].click();
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(0);
			});

			it('Closes on clicks elsewhere in the root and outside the host', () => {
				buttons[0].click();
				root.querySelector('td').click();
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(0);
				buttons[0].click();
				document.body.click();
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(0);
			});

			it('Allows Tab between controls and wraps at the ends', () => {
				buttons[0].click();
				let controls = root.querySelector('.dtcc-dropdown').querySelectorAll('a, button, input, select');
				controls[1].focus();
				let tab = new KeyboardEvent('keydown', {
					key: 'Tab', bubbles: true, composed: true, cancelable: true
				});
				controls[1].dispatchEvent(tab);
				expect(tab.defaultPrevented).toBe(false);
				let last = controls[controls.length - 1];
				last.focus();
				last.dispatchEvent(new KeyboardEvent('keydown', {
					key: 'Tab', bubbles: true, composed: true, cancelable: true
				}));
				expect((mode === 'document' ? document : root).activeElement).toBe(controls[0]);
				controls[0].dispatchEvent(new KeyboardEvent('keydown', {
					key: 'Tab', shiftKey: true, bubbles: true, composed: true, cancelable: true
				}));
				expect((mode === 'document' ? document : root).activeElement).toBe(last);
			});

			it('Escape closes the menu and restores button focus', () => {
				buttons[0].click();
				root.querySelector('.dtcc-dropdown input').dispatchEvent(new KeyboardEvent('keydown', {
					key: 'Escape', bubbles: true, composed: true
				}));
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(0);
				expect((mode === 'document' ? document : root).activeElement).toBe(buttons[0]);
			});

			it('Preserves the parent when a nested menu opens', () => {
				buttons[0].click();
				root.querySelector('.dtcc-dropdown .dtcc-button_dropdown').click();
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(2);
				document.body.click();
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(0);
			});

			it('Does not close while interacting with a DateTime popup in the root', () => {
				buttons[0].click();
				let picker = document.createElement('div');
				picker.className = 'dt-datetime';
				root.append(picker);
				picker.click();
				expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(1);
				picker.remove();
			});

			it('Aligns to the button inside an offset and bordered container', () => {
				table.table().container().style.border = '8px solid transparent';
				buttons[0].click();
				let menu = root.querySelector('.dtcc-dropdown');
				let buttonRect = buttons[0].getBoundingClientRect();
				let menuRect = menu.getBoundingClientRect();
				expect(Math.abs(menuRect.top - buttonRect.bottom)).toBeLessThan(1);
			});

			it('Positions correctly through an intermediate scrolling element', () => {
				let tableNode = table.table().node();
				let scroller = document.createElement('div');
				scroller.style.cssText = 'position:relative;overflow:scroll;height:40px;width:600px';
				tableNode.before(scroller);
				scroller.append(tableNode);
				tableNode.style.cssText = 'width:900px;margin-top:30px';
				scroller.scrollLeft = 60;
				scroller.scrollTop = 20;
				buttons[1].click();
				let menuRect = root.querySelector('.dtcc-dropdown').getBoundingClientRect();
				let buttonRect = buttons[1].getBoundingClientRect();
				expect(Math.abs(menuRect.top - buttonRect.bottom)).toBeLessThan(1);
				expect(Math.abs(menuRect.right - buttonRect.right)).toBeLessThan(1);
			});

			it('Closes a menu in another root when opening this one', () => {
				let other = document.createElement('div');
				document.body.append(other);
				let otherRoot = other.attachShadow({ mode: 'closed' });
				otherRoot.innerHTML = '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>';
				let otherTable = new DataTable(otherRoot.querySelector('table'), {
					columnControl: [['orderAsc']]
				});
				try {
					otherRoot.querySelector('.dtcc-button_dropdown').click();
					let menu = otherRoot.querySelector('.dtcc-dropdown');
					buttons[0].click();
					expect(menu.isConnected).toBe(false);
					expect(root.querySelectorAll('.dtcc-dropdown').length).toBe(1);
				}
				finally {
					otherTable.destroy();
					other.remove();
				}
			});

			it('Removes the popup and event handling when destroyed while open', () => {
				buttons[0].click();
				let menu = root.querySelector('.dtcc-dropdown');
				table.destroy();
				expect(menu.isConnected).toBe(false);
				let tab = new KeyboardEvent('keydown', {
					key: 'Tab', bubbles: true, composed: true, cancelable: true
				});
				document.body.dispatchEvent(tab);
				expect(tab.defaultPrevented).toBe(false);
			});
		});
	});
});
