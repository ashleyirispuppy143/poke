#!/usr/bin/env python3
#
#    Copyright (C) 2024-20xx Poke! (https://codeberg.org/ashleyirispuppy/poke)
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

import gi
import json
import vlc
import subprocess
import urllib.request

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GdkPixbuf, GObject
from gi.repository import Gio

class PokeGtkApp(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Poke Desktop")
        self.set_default_size(800, 600)

        self.vlc_instance = vlc.Instance('--no-xlib')
        self.player = self.vlc_instance.media_player_new()
        self.is_playing = False

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(vbox)

        self.search_entry = Gtk.Entry()
        self.search_entry.set_placeholder_text("Enter search query")
        vbox.pack_start(self.search_entry, False, False, 0)

        hbox_buttons = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        vbox.pack_start(hbox_buttons, False, False, 0)

        self.search_button = Gtk.Button(label="Search")
        self.search_button.connect("clicked", self.on_search_clicked)
        hbox_buttons.pack_start(self.search_button, True, True, 0)

        self.play_button = Gtk.Button(label="Play")
        self.play_button.connect("clicked", self.on_play_clicked)
        hbox_buttons.pack_start(self.play_button, False, False, 0)
        self.play_button.set_sensitive(False)  # Initially disabled

        self.pause_button = Gtk.Button(label="Pause")
        self.pause_button.connect("clicked", self.on_pause_clicked)
        hbox_buttons.pack_start(self.pause_button, False, False, 0)
        self.pause_button.set_sensitive(False)  # Initially disabled

        self.bottom_bar_label = Gtk.Label()
        vbox.pack_end(self.bottom_bar_label, False, False, 0)

        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        vbox.pack_start(scrolled_window, True, True, 0)

        self.video_liststore = Gtk.ListStore(GdkPixbuf.Pixbuf, str, str, str)  # Changed the order of columns
        self.treeview = Gtk.TreeView(model=self.video_liststore)

        thumbnail_column = Gtk.TreeViewColumn("Thumbnail")  # Thumbnail column at the first position
        title_column = Gtk.TreeViewColumn("Title")  # Title column at the second position
        author_column = Gtk.TreeViewColumn("Author")

        self.treeview.append_column(thumbnail_column)
        self.treeview.append_column(title_column)
        self.treeview.append_column(author_column)

        thumbnail_cell = Gtk.CellRendererPixbuf()
        title_cell = Gtk.CellRendererText()
        author_cell = Gtk.CellRendererText()

        thumbnail_column.pack_start(thumbnail_cell, True)
        title_column.pack_start(title_cell, True)
        author_column.pack_start(author_cell, True)

        thumbnail_column.add_attribute(thumbnail_cell, "pixbuf", 0)
        title_column.add_attribute(title_cell, "text", 1)
        author_column.add_attribute(author_cell, "text", 2)

        self.treeview.connect("row-activated", self.on_video_selected)

        scrolled_window.add(self.treeview)

        # Tray icon setup
        self.tray_icon = Gtk.StatusIcon.new()
        self.tray_icon.set_from_gicon(Gio.ThemedIcon.new("media-playback-start-symbolic"))  # Set the icon
        self.tray_icon.connect("activate", self.on_tray_icon_clicked)
        self.tray_icon.connect("popup-menu", self.on_tray_icon_popup_menu)

    def on_tray_icon_clicked(self, icon, button):
        if button == Gdk.BUTTON_PRIMARY:
            if self.is_playing:
                self.player.pause()
                self.tray_icon.set_from_icon_name("media-playback-start")
            else:
                self.player.play()
                self.tray_icon.set_from_icon_name("media-playback-pause")
            self.is_playing = not self.is_playing

    def on_tray_icon_popup_menu(self, icon, button, time):
        menu = Gtk.Menu()

        play_pause_item = Gtk.MenuItem("Play/Pause")
        play_pause_item.connect("activate", self.on_tray_icon_clicked, Gdk.BUTTON_PRIMARY)
        menu.append(play_pause_item)

        quit_item = Gtk.MenuItem("Quit")
        quit_item.connect("activate", Gtk.main_quit)
        menu.append(quit_item)

        menu.show_all()
        menu.popup(None, None, None, None, button, time)

    def on_search_clicked(self, button):
        search_query = self.search_entry.get_text()
        json_data = self.fetch_data(search_query)
        self.populate_video_list(json_data)

    def on_video_selected(self, treeview, path, column):
        selection = self.video_liststore[path]
        video_title, video_url, author_name = selection[1], selection[3], selection[2]  # Adjusted index due to column order change

        # Play the selected video
        self.play_video(video_url)
        self.update_bottom_bar(video_title)

    def fetch_data(self, search_query):
        invid_api_url = "https://invid-api.poketube.fun"
        search_query_encoded = search_query.replace(" ", "+")
        curl_command = f'curl -s "{invid_api_url}/api/v1/search?q={search_query_encoded}&type=video"'
        try:
            output = subprocess.check_output(curl_command, shell=True)
            data = output.decode("utf-8")
            return json.loads(data)
        except subprocess.CalledProcessError as e:
            print(f"Error fetching data: {e}")
            return []

    def populate_video_list(self, json_data):
        self.video_liststore.clear()
        for video in json_data:
            title = video["title"]
            video_id = video["videoId"]
            author = video["author"]  # Added to retrieve author's name
            video_url = f"https://poketube.fun/watch?v={video_id}"
            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/default.jpg"
            thumbnail = self.load_thumbnail(thumbnail_url)  # Load thumbnail from URL
            self.video_liststore.append([thumbnail, title, author, video_url])

    def load_thumbnail(self, url):
        response = urllib.request.urlopen(url)
        data = response.read()
        loader = GdkPixbuf.PixbufLoader()
        loader.write(data)
        loader.close()
        return loader.get_pixbuf()

    def play_video(self, video_url):
        try:
            command = ['yt-dlp', '-g', video_url]
            video_direct_url = subprocess.check_output(command).decode('utf-8').strip()
            media = self.vlc_instance.media_new(video_direct_url)
            self.player.set_media(media)
            self.player.play()
            self.is_playing = True
            self.play_button.set_sensitive(True)  # Enable play button
            self.pause_button.set_sensitive(True)  # Enable pause button
        except Exception as e:
            print(f"Error playing video: {e}")

    def on_play_clicked(self, button):
        if self.is_playing:
            self.player.play()

    def on_pause_clicked(self, button):
        if self.is_playing:
            self.player.pause()

    def update_bottom_bar(self, text):
        self.bottom_bar_label.set_text(text)

def main():
    app = PokeGtkApp()
    app.connect("destroy", Gtk.main_quit)
    app.show_all()
    Gtk.main()

if __name__ == "__main__":
    main()
