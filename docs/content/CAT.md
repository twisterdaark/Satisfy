# The cat (v3.06)

Requested by the player Suki through the owner (2026-10-25): "rework cat sprites, currently they're dull and barely visible,
be able to pet them aswell".

## The sprite (`drawPet0`, `a.k==='cat'`)

The old cat was grey (`#8a8e98`) with no outline. The new one is:
- an orange tabby (`#ec9a3e`) with darker stripes, a white muzzle, white paws and a white belly;
- green eyes and a pink nose;
- outlined in `#1a1220`, the colour the item icons use.

An evolved cat is black and violet with a light violet rim, so it shows on dark ground too. A kitten (below pet level 5) is
drawn at 0.9 instead of ¾.

## Petting (`ctNear`, `ctPet`)

You can pet your cat when all of these hold:
- your cat is out;
- it is within 22 px of you (at your feet: it trails 14–30 px behind you as you walk);
- you are standing still;
- nothing else is within E's reach (`nearest()` is null).

The hint then says "E: Pet your cat", and E pets it:
- its eyes close and a heart rises over it for 1.4 s;
- pink motes rise;
- once every three minutes (`S.ctPet`, session state), it gets 10 pet experience and a line shows.

`tests/regression/catpet.test.cjs` covers it.
