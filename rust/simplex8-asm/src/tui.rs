//! # [Ratatui] List example
//!
//! The latest version of this example is available in the [examples] folder in the repository.
//!
//! Please note that the examples are designed to be run against the `main` branch of the Github
//! repository. This means that you may not be able to compile with the latest release version on
//! crates.io, or the one that you have installed locally.
//!
//! See the [examples readme] for more information on finding examples that match the version of the
//! library you are using.
//!
//! [Ratatui]: https://github.com/ratatui/ratatui
//! [examples]: https://github.com/ratatui/ratatui/blob/main/examples
//! [examples readme]: https://github.com/ratatui/ratatui/blob/main/examples/README.md

use ratatui::{
    buffer::Buffer,
    crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind},
    layout::{Constraint, Layout, Rect, Flex},
    style::{
        palette::tailwind::{BLUE, GREEN, SLATE},
        Color, Modifier, Style, Stylize,
    },
    symbols,
    text::Line,
    widgets::{
        Block, Borders, HighlightSpacing, List, ListItem, Padding, Paragraph,
        Widget, Wrap, Clear
    },
    DefaultTerminal,
};
use std::io::Result;

use crate::{sim::{Sim, REG_COUNT}, simplex8::{self, opcode_str, AssemblyError}};

const TODO_HEADER_STYLE: Style = Style::new().fg(SLATE.c100).bg(BLUE.c800);
const NORMAL_ROW_BG: Color = SLATE.c950;
const ALT_ROW_BG_COLOR: Color = SLATE.c900;
const SELECTED_STYLE: Style = Style::new().bg(SLATE.c800).add_modifier(Modifier::BOLD);
const TEXT_FG_COLOR: Color = SLATE.c200;
const COMPLETED_TEXT_FG_COLOR: Color = GREEN.c500;

// fn main() -> Result<()> {
//     // color_eyre::install()?;
//     let terminal = ratatui::init();
//     let app_result = App::default().run(terminal);
//     ratatui::restore();
//     app_result
// }

/// This struct holds the current state of the app. In particular, it has the `todo_list` field
/// which is a wrapper around `ListState`. Keeping track of the state lets us render the
/// associated widget with its state and have access to features such as natural scrolling.
///
/// Check the event handling at the bottom to see how to change the state on incoming events. Check
/// the drawing logic for items on how to specify the highlighting style for selected items.
pub struct App {
    sim: Sim,
    should_exit: bool,
    // error: Result<(), AssemblyError>,
    show_error: bool,
}

impl App {
    pub fn new(sim: Sim) -> Self {
        Self {
            sim: sim,
            should_exit: false,
            show_error: false,
        }
    }

    pub fn run(mut self, mut terminal: DefaultTerminal) -> Result<()> {
        while !self.should_exit {
            terminal.draw(|frame| {
                frame.render_widget(&mut self, frame.area());
                if self.show_error {
                    let block = Block::bordered().title("ERROR");
                    let area = popup_area(frame.area(), 60, 20);
                    frame.render_widget(Clear, area); //this clears out the background
                    frame.render_widget(block, area);
                }
        })?;
            if let Event::Key(key) = event::read()? {
                self.handle_key(key);
            };
        }
        Ok(())
    }

    fn handle_key(&mut self, key: KeyEvent) {
        if key.kind != KeyEventKind::Press {
            return;
        }
        self.show_error = false;
        match key.code {
            KeyCode::Char('q') | KeyCode::Esc => self.should_exit = true,
            KeyCode::Char('r') => self.sim.reset(),
            KeyCode::Char('e') => self.show_error = true,
            KeyCode::Char('s') => if self.sim.step().is_err() { self.show_error = true; },
            KeyCode::Char('l') | KeyCode::Right | KeyCode::Enter => {
                // self.toggle_status();
            }
            _ => {}
        }
    }
}

impl Widget for &mut App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let [header_area, main_area, footer_area] = Layout::vertical([
            Constraint::Length(2),
            Constraint::Fill(1),
            Constraint::Length(1),
        ])
        .areas(area);

        let [inst_area, registers_area, screen_area] =
            Layout::horizontal([Constraint::Fill(1), Constraint::Fill(1), Constraint::Fill(1)]).areas(main_area);

        App::render_header(header_area, buf);
        App::render_footer(footer_area, buf);
        self.render_program_memory(inst_area, buf);
        self.render_registers(registers_area, buf);
        self.render_screen(screen_area, buf);
    }
}


/// helper function to create a centered rect using up certain percentage of the available rect `r`
fn popup_area(area: Rect, percent_x: u16, percent_y: u16) -> Rect {
    let vertical = Layout::vertical([Constraint::Percentage(percent_y)]).flex(Flex::Center);
    let horizontal = Layout::horizontal([Constraint::Percentage(percent_x)]).flex(Flex::Center);
    let [area] = vertical.areas(area);
    let [area] = horizontal.areas(area);
    area
}

/// Rendering logic for the app
impl App {
    fn render_header(area: Rect, buf: &mut Buffer) {
        Paragraph::new("SIMPLEX8 SIMULATOR")
            .bold()
            .centered()
            .render(area, buf);
    }

    fn render_footer(area: Rect, buf: &mut Buffer) {
        Paragraph::new("Use s to step, r to reset, q to quit.")
            .centered()
            .render(area, buf);
    }

    fn render_program_memory(&mut self, area: Rect, buf: &mut Buffer) {
        let block = Block::new()
            .title(Line::raw("INSTRUCTION MEMORY").centered())
            .borders(Borders::ALL)
            .border_set(symbols::border::EMPTY)
            .border_style(TODO_HEADER_STYLE)
            .bg(NORMAL_ROW_BG);

        let start_addr = if self.sim.pc < 10 {
            0
        } else {
            self.sim.pc - 10
        };
        let end_addr = self.sim.pc + 10;

        // Iterate through all elements in the `items` and stylize them.
        let items: Vec<ListItem> = self.sim.inst_mem[start_addr..end_addr]
            .iter()
            .enumerate()
            .map(|(i, mem_item)| {
                let address: usize = start_addr + i;
                let color = if address == self.sim.pc {
                    COMPLETED_TEXT_FG_COLOR
                } else {
                    alternate_colors(i)
                };
                let opcode_str = opcode_str(*mem_item >> 4).unwrap_or("???");
                let arg: u8 = *mem_item & 0xF;
                ListItem::from(format!("0x{address:04x}: {opcode_str} {arg}")).bg(color)
            })
            .collect();

        // Create a List from all list items and highlight the currently selected one
        let list = List::new(items)
            .block(block)
            .highlight_style(SELECTED_STYLE)
            .highlight_symbol(">")
            .highlight_spacing(HighlightSpacing::Always);

        // We need to disambiguate this trait method as both `Widget` and `StatefulWidget` share the
        // same method name `render`.
        Widget::render(list, area, buf);
    }

    
    fn render_registers(&mut self, area: Rect, buf: &mut Buffer) {
        let block = Block::new()
            .title(Line::raw("REGISTERS").centered())
            .borders(Borders::ALL)
            .border_set(symbols::border::EMPTY)
            .border_style(TODO_HEADER_STYLE)
            .bg(NORMAL_ROW_BG);

        // Iterate through all elements in the `items` and stylize them.
        let items: Vec<ListItem> = self.sim.reg[0..REG_COUNT]
            .iter()
            .enumerate()
            .map(|(i, reg_val)| {
                // let address: usize = start_addr + i;
                let color = if self.sim.last_reg.is_some_and(|last_reg| last_reg == i ) {
                    COMPLETED_TEXT_FG_COLOR
                } else {
                    alternate_colors(i)
                };
                ListItem::from(format!("${i:x}: {reg_val:02x}")).bg(color)
            })
            .collect();

        // Create a List from all list items and highlight the currently selected one
        let list = List::new(items)
            .block(block)
            .highlight_style(SELECTED_STYLE)
            .highlight_symbol(">")
            .highlight_spacing(HighlightSpacing::Always);

        // We need to disambiguate this trait method as both `Widget` and `StatefulWidget` share the
        // same method name `render`.
        Widget::render(list, area, buf);
    }

    fn render_screen(&self, area: Rect, buf: &mut Buffer) {
        // We show the list item's info under the list in this paragraph
        let block = Block::new()
            .title(Line::raw("SCREEN").centered())
            .borders(Borders::ALL)
            .border_set(symbols::border::EMPTY)
            .border_style(TODO_HEADER_STYLE)
            .bg(NORMAL_ROW_BG)
            .padding(Padding::uniform(1));

        // We can now render the item info
        Paragraph::new("Here will go the screen! \n1 \n2 \n ...")
            .block(block)
            .fg(TEXT_FG_COLOR)
            .wrap(Wrap { trim: false })
            .render(area, buf);
    }
}

const fn alternate_colors(i: usize) -> Color {
    if i % 2 == 0 {
        NORMAL_ROW_BG
    } else {
        ALT_ROW_BG_COLOR
    }
}

// impl From<&MemoryItem> for ListItem<'_> {
//     fn from(value: &MemoryItem) -> Self {
//         let style = match value.status {
//             Status::Todo => TEXT_FG_COLOR,
//             Status::Completed => COMPLETED_TEXT_FG_COLOR,
//         };
//         let line = Line::styled(format!("0x{}: {}", value.address, value.value), style);
//         ListItem::new(line)
//     }
// }
