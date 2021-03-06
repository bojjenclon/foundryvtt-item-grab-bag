import { addItemToBag, pickUpItem, removeFromBag } from "./grab-bag-utils";
import { SocketMessageType } from "./socket-message-type";

export default class GrabBagWindow extends Application {
  private static dialog: GrabBagWindow;

  static get defaultOptions(): ApplicationOptions {
    return mergeObject(super.defaultOptions, {
      template: 'modules/item-grab-bag/templates/grab-bag-window.html',

      id: 'item-grab-bag-window',
      classes: ['item-grab-bag', 'bag-window'],
      title: 'Item Grab Bag',

      dragDrop: [{
        dropSelector: '.bag-content'
      }],

      width: 300,
      height: 450,
      minimizable: true,
      resizable: true
    });
  }

  constructor() {
    super();
  }

  static openDialog() {
    if (!this.dialog) {
      this.dialog = new GrabBagWindow();
    }

    this.dialog.render(true);
  }

  static closeDialog(): Promise<any> {
    return this.dialog.close();
  }

  getData() {
    const itemData = game.settings.get('item-grab-bag', 'bag-contents');
    const items = itemData.map((id: string) => game.items.get(id));

    const data = {
      isGM: game.user.isGM,
      items
    };

    return data;
  }

  activateListeners(html: JQuery) {
    super.activateListeners(html);

    html.find('.item .name').on('click', async (evt) => {
      evt.preventDefault();

      const { actorId, itemId } = evt.currentTarget.parentElement.dataset;
      let item: Item;
      if (actorId) {
        const actor = game.actors.get(actorId);
        item = actor.items.get(itemId);
      } else {
        item = game.items.get(itemId);
      }

      if (item) {
        item.sheet.render(true);
      } else {
        // The item was likely removed from the game, so
        // remove it from the bag as well

        const itemIdx = evt.currentTarget.parentElement.dataset.bagIdx;
        await this._removeFromBag(parseInt(itemIdx, 10));

        ui.notifications.warn(game.i18n.localize('GRABBAG.warning.invalidItem'));
      }
    });

    if (game.user.isGM) {
      html.find('.btn-remove').on('click', async evt => {
        evt.preventDefault();

        const itemIdx = evt.currentTarget.parentElement.dataset.bagIdx;
        await this._removeFromBag(parseInt(itemIdx, 10));
      });
    } else {
      html.find('.btn-take').on('click', async evt => {
        evt.preventDefault();

        const itemIdx = evt.currentTarget.parentElement.dataset.bagIdx;

        await this._takeFromBag(parseInt(itemIdx, 10));
      });
    }
  }

  async _removeFromBag(itemIdx: number) {
    if (!isNaN(itemIdx)) {
      await removeFromBag(itemIdx);

      setTimeout(() => {
        GrabBagWindow.openDialog();
      }, 0);

      game.socket.emit('module.item-grab-bag', {
        type: SocketMessageType.removeItemFromBag,
        data: {
          index: itemIdx
        }
      });
    }
  }

  async _takeFromBag(itemIdx: number) {
    if (!isNaN(itemIdx)) {
      await pickUpItem(itemIdx);

      setTimeout(() => {
        GrabBagWindow.openDialog();
      }, 0);

      game.socket.emit('module.item-grab-bag', {
        type: SocketMessageType.itemPickedUp,
        data: {
          index: itemIdx
        }
      });
    }
  }

  _canDragDrop(selector: string): boolean {
    console.log(selector);

    return true;
  }

  async _onDrop(evt: DragEvent) {
    const { dataTransfer } = evt;
    const { items } = dataTransfer;

    if (items) {
      const numItems = items.length;
      for (let i = 0; i < numItems; i++) {
        const itm = items[i];
        if (itm.kind === 'string' && itm.type.match('^text/plain')) {
          itm.getAsString(async (str) => {
            const data = JSON.parse(str);

            await addItemToBag(data);

            GrabBagWindow.openDialog();
          });
        }
      }
    }
  }
}
